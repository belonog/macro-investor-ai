import axios from 'axios';
import { EarningsEvent, RawIndicator } from '../../types/index.js';

const POLYGON_BASE = 'https://api.polygon.io';

/**
 * Gets EOD prices for a list of symbols.
 * @param symbols The stock symbols
 * @returns Promise<Record<string, number>>
 */
export async function getEodPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  for (const symbol of symbols) {
    const response = await axios.get(`${POLYGON_BASE}/v2/aggs/ticker/${symbol}/prev`, {
      params: { adjusted: true, apiKey: process.env.POLYGON_API_KEY }
    });
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
  const response = await axios.get(`${POLYGON_BASE}/vX/reference/tickers/earnings`, {
    params: { apiKey: process.env.POLYGON_API_KEY }
  });

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
 * Gets the gold spot price.
 * @returns Promise<RawIndicator>
 */
export async function getGoldSpotPrice(): Promise<RawIndicator> {
  const response = await axios.get(`${POLYGON_BASE}/v2/aggs/ticker/C:XAUUSD/prev`, {
    params: { adjusted: true, apiKey: process.env.POLYGON_API_KEY }
  });
  
  let value = 0;
  let asOf = new Date().toISOString().split('T')[0];
  
  if (response.data && response.data.results && response.data.results.length > 0) {
    value = response.data.results[0].c;
    // Polygon timestamp is in ms
    if (response.data.results[0].t) {
      asOf = new Date(response.data.results[0].t).toISOString().split('T')[0];
    }
  }
  
  return {
    value,
    unit: 'USD per troy oz',
    source: 'COMEX spot',
    as_of: asOf,
  };
}
