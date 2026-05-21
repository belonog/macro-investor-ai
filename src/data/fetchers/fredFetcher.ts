import axios from 'axios';
import { DataPoint, DataPointSchema, MacroSnapshot, MacroCacheSchema, MacroIndicators } from '../../types/index.js';
import { RAW_FRED_SERIES_IDS, getRawSeriesDescription } from '../indicators/registry.js';
import { deriveMetrics } from '../indicators/derivation.js';
import { logger } from '../../utils/logger.js';
import { db } from '../../db/database.js';
import { env } from '../../config/env.js';
import { withRetry } from '../../utils/retry.js';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

/**
 * Fetches a series from FRED and returns it as an array of DataPoints.
 * @param seriesId The FRED series ID (e.g., 'INDPRO')
 * @param startDate Optional date to start fetching from (YYYY-MM-DD)
 * @returns Promise<DataPoint[]>
 */
export async function fetchSeries(seriesId: string, startDate?: string): Promise<DataPoint[]> {
  const apiKey = env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error('FRED_API_KEY is not set');
  }

  const defaultStartDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const obsStart = startDate || defaultStartDate;

  const response = await withRetry(() => axios.get(`${FRED_BASE_URL}/series/observations`, {
    params: {
      series_id: seriesId,
      api_key: apiKey,
      file_type: 'json',
      sort_order: 'asc',
      observation_start: obsStart,
    }
  }));

  if (!response.data || !response.data.observations) {
    throw new Error(`Failed to fetch series ${seriesId}`);
  }

  const points: DataPoint[] = [];
  for (const obs of response.data.observations) {
    if (obs.value !== '.') {
      const parsed = DataPointSchema.safeParse({
        date: obs.date,
        value: parseFloat(obs.value)
      });
      if (parsed.success) {
        points.push(parsed.data);
      }
    }
  }

  return points;
}

/**
 * Fetches all target series concurrently.
 * @returns Promise<MacroSnapshot>
 */
export async function fetchAll(): Promise<MacroSnapshot> {
  const snapshot: MacroSnapshot = {
    series: {},
    fetched_at: {}
  };
  
  const promises = RAW_FRED_SERIES_IDS.map(async (seriesId) => {
    try {
      const data = await fetchSeries(seriesId);
      snapshot.series[seriesId] = data;
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    } catch {
      const desc = getRawSeriesDescription(seriesId);
      logger.error(`Failed to fetch ${seriesId} (${desc})`);
      snapshot.series[seriesId] = []; // Ensure the key exists even on failure
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  });

  await Promise.all(promises);
  return snapshot;
}

/**
 * Fetches all target series incrementally and updates the SQLite cache.
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
    // Ignore cache read errors
  }

  const snapshot: MacroSnapshot = {
    series: { ...existingSnapshot.series },
    fetched_at: { ...existingSnapshot.fetched_at }
  };
  
  const promises = RAW_FRED_SERIES_IDS.map(async (seriesId) => {
    try {
      const cachedSeries = snapshot.series[seriesId] || [];
      let startDate: string | undefined = undefined;
      
      if (cachedSeries.length > 0) {
        startDate = cachedSeries[cachedSeries.length - 1].date;
      }
      
      const newPoints = await fetchSeries(seriesId, startDate);
      
      // Merge
      const map = new Map<string, DataPoint>();
      for (const p of cachedSeries) map.set(p.date, p);
      for (const p of newPoints) map.set(p.date, p);
      
      const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      
      snapshot.series[seriesId] = merged;
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    } catch (error) {
      const desc = getRawSeriesDescription(seriesId);
      logger.error(error, `Failed to fetch ${seriesId} (${desc})`);
      if (!snapshot.series[seriesId]) {
        snapshot.series[seriesId] = [];
      }
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  });

  await Promise.all(promises);
  
  const cacheData = {
    fetched_at: new Date().toISOString(),
    data: snapshot
  };
  
  db.setCache('macro_snapshot', cacheData);
  return snapshot;
}

/**
 * Returns the latest single value for each series in the target basket,
 * along with derived trend and spread metrics.
 * Attempts to read from SQLite cache first, falls back to fetching.
 * @returns Promise<MacroIndicators>
 */
export async function getLatestValues(): Promise<MacroIndicators> {
  let snapshot: MacroSnapshot;
  try {
    const rawCache = db.getCache<unknown>('macro_snapshot');
    if (!rawCache) {
      snapshot = await updateMacroCache();
    } else {
      const parsed = MacroCacheSchema.safeParse(rawCache);
      if (!parsed.success) {
        logger.warn('Invalid macro cache. Re-fetching...');
        snapshot = await updateMacroCache();
      } else {
        snapshot = parsed.data.data;
      }
    }
  } catch {
    snapshot = await updateMacroCache();
  }

  return deriveMetrics(snapshot, new Date().toISOString());
}
