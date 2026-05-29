import axios from 'axios';
import { DataPoint, DataPointSchema, EarningsEvent, MacroCacheSchema, MacroSnapshot } from '../../types/index.js';
import { RAW_POLYGON_SERIES_IDS } from '../indicators/registry.js';
import { env } from '../../config/env.js';
import { db } from '../../db/database.js';
import { logger } from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';

const POLYGON_BASE = 'https://api.polygon.io';

let polygonQueue: Promise<void> = Promise.resolve();
let requestTimestamps: number[] = [];

/**
 * Enqueues a Polygon request using a sliding window token bucket to optimize
 * execution time while strictly enforcing the rate limit.
 */
function enqueuePolygonRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  const limit = env.POLYGON_API_LIMIT;
  const windowMs = env.POLYGON_API_WINDOW_MS;
  
  const next = polygonQueue.then(async () => {
    let now = Date.now();
    
    // Clean up timestamps older than the window
    requestTimestamps = requestTimestamps.filter(t => now - t < windowMs);
    
    if (requestTimestamps.length >= limit) {
      // The oldest relevant request is the first one in the array (length is exactly limit or more)
      // Since we just filtered, it's definitely less than windowMs old.
      // Wait for it to expire out of the window.
      const oldest = requestTimestamps[0];
      const waitTime = Math.max(0, windowMs - (now - oldest));
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // Update our notion of 'now' after waiting
      now = Date.now();
      requestTimestamps = requestTimestamps.filter(t => now - t < windowMs);
    }
    
    try {
      return await requestFn();
    } finally {
      requestTimestamps.push(Date.now());
    }
  });
  
  // Catch errors so the queue doesn't break for subsequent requests
  polygonQueue = next.catch(() => {}) as Promise<void>;
  
  return next;
}

/**
 * Gets EOD prices for a list of symbols.
 * @param symbols The stock symbols
 * @returns Promise<Record<string, number>>
 */
export async function getEodPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  for (const symbol of symbols) {
    const response = await withRetry(() => enqueuePolygonRequest(() => axios.get(`${POLYGON_BASE}/v2/aggs/ticker/${symbol}/prev`, {
      params: { adjusted: true, apiKey: env.POLYGON_API_KEY }
    })));
    if (response.data && response.data.results && response.data.results.length > 0) {
      prices[symbol] = response.data.results[0].c;
    } else {
      prices[symbol] = 0;
    }
  }
  return prices;
}

/**
 * Gets the earnings calendar for a list of symbols.
 * @param symbols The stock symbols
 * @param _daysAhead Number of days ahead to search
 * @returns Promise<EarningsEvent[]>
 */
export async function getEarningsCalendar(symbols: string[], _daysAhead: number): Promise<EarningsEvent[]> {
  const response = await withRetry(() => enqueuePolygonRequest(() => axios.get(`${POLYGON_BASE}/vX/reference/tickers/earnings`, {
    params: { apiKey: env.POLYGON_API_KEY }
  })));

  const events: EarningsEvent[] = [];
  for (const item of response.data.results || []) {
    if (symbols.includes(item.ticker)) {
      events.push({
        symbol: item.ticker,
        report_date: item.report_date,
        eps_estimate: item.eps_estimate || null,
        time_of_day: item.amc ? 'post' : item.bmo ? 'pre' : 'unknown'
      });
    }
  }
  return events;
}

/**
 * Fetches a Polygon ticker as a daily time series and returns it as DataPoint[].
 * Uses the /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to} endpoint.
 * Gaps (weekends, holidays) are left as-is — only trading days are returned.
 * @param ticker  Polygon ticker (e.g. 'C:XAUUSD')
 * @param startDate  ISO date string YYYY-MM-DD to start from. Defaults to 3 years ago.
 * @returns Promise<DataPoint[]> sorted ascending by date
 */
export async function fetchSeries(ticker: string, startDate?: string): Promise<DataPoint[]> {
  // 3-year default window matches FRED fetcher — provides safe margin for 3-month change calculations
  const defaultStartDate = new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const from = startDate ?? defaultStartDate;
  const to = new Date().toISOString().split('T')[0];

  const response = await withRetry(() =>
    enqueuePolygonRequest(() => axios.get(`${POLYGON_BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}`, {
      params: { adjusted: true, sort: 'asc', limit: 50000, apiKey: env.POLYGON_API_KEY },
    }))
  );

  const results: unknown[] = response.data?.results ?? [];
  const points: DataPoint[] = [];

  for (const bar of results) {
    if (
      bar !== null &&
      typeof bar === 'object' &&
      't' in bar &&
      'c' in bar &&
      typeof (bar as Record<string, unknown>).t === 'number' &&
      typeof (bar as Record<string, unknown>).c === 'number'
    ) {
      const date = new Date((bar as { t: number }).t).toISOString().split('T')[0];
      const parsed = DataPointSchema.safeParse({ date, value: (bar as { c: number }).c });
      if (parsed.success) {
        points.push(parsed.data);
      }
    }
  }

  return points;
}

/**
 * Fetches all Polygon tickers in RAW_POLYGON_SERIES_IDS incrementally and
 * merges the results into the shared 'macro_snapshot' SQLite cache.
 *
 * IMPORTANT: Must be called sequentially after other updateMacroCache() calls
 * (fred, bls, eia) to avoid the shared-key race condition where the last writer
 * overwrites everyone else's data.
 *
 * @returns Promise<MacroSnapshot>
 */
export async function updateMacroCache(): Promise<MacroSnapshot> {
  let existingSnapshot: MacroSnapshot = { series: {}, fetched_at: {} };

  try {
    const rawCache = db.getCache<unknown>('macro_snapshot');
    if (rawCache) {
      const parsed = MacroCacheSchema.safeParse(rawCache);
      if (parsed.success) {
        existingSnapshot = parsed.data.data;
      }
    }
  } catch {
    // Ignore cache read errors — start fresh
  }

  const snapshot: MacroSnapshot = {
    series: { ...existingSnapshot.series },
    fetched_at: { ...existingSnapshot.fetched_at },
  };

  for (const ticker of RAW_POLYGON_SERIES_IDS) {
    try {
      const cachedSeries = snapshot.series[ticker] ?? [];
      // gold_price_usd has revision_lookback_periods: 0, so start from the last cached date
      const startDate = cachedSeries.length > 0
        ? cachedSeries[cachedSeries.length - 1].date
        : undefined;

      const newPoints = await fetchSeries(ticker, startDate);

      // Merge by date — new points overwrite cached points on the same date
      const map = new Map<string, DataPoint>();
      for (const p of cachedSeries) map.set(p.date, p);
      for (const p of newPoints) map.set(p.date, p);

      snapshot.series[ticker] = Array.from(map.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      snapshot.fetched_at[ticker] = new Date().toISOString();
    } catch (error) {
      logger.error(error, `Failed to fetch Polygon series ${ticker}`);
      if (!snapshot.series[ticker]) {
        snapshot.series[ticker] = [];
      }
      snapshot.fetched_at[ticker] = new Date().toISOString();
    }
  }

  db.setCache('macro_snapshot', { fetched_at: new Date().toISOString(), data: snapshot });
  return snapshot;
}
