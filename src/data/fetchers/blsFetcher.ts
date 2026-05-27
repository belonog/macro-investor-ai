import axios from 'axios';
import { z } from 'zod';
import { DataPoint, DataPointSchema, MacroSnapshot, MacroCacheSchema } from '../../types/index.js';
import { RAW_BLS_SERIES_IDS, getRevisionLookbackPeriods } from '../indicators/registry.js';
import { logger } from '../../utils/logger.js';
import { db } from '../../db/database.js';
import { env } from '../../config/env.js';
import { withRetry } from '../../utils/retry.js';

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

interface BLSPayload {
  seriesid: string[];
  startyear: string;
  endyear: string;
  registrationkey?: string;
}

export const BLSSeriesDataSchema = z.object({
  year: z.string(),
  period: z.string().optional(),
  periodName: z.string(),
  value: z.string(),
  footnotes: z.array(z.any()).optional()
}).passthrough();

export const BLSSeriesSchema = z.object({
  seriesID: z.string(),
  data: z.array(BLSSeriesDataSchema)
}).passthrough();

export const BLSResponseSchema = z.array(BLSSeriesSchema);

export type BLSSeries = z.infer<typeof BLSSeriesSchema>;

/**
 * Fetches multiple series from BLS and converts them to a map of seriesId -> DataPoint[].
 * @param seriesIds The BLS series IDs
 * @param startYear Start year for the data
 * @param endYear End year for the data
 * @returns Promise<Record<string, DataPoint[]>>
 */
export async function fetchSeries(seriesIds: string[], startYear: string, endYear: string): Promise<Record<string, DataPoint[]>> {
  if (seriesIds.length === 0) return {};

  const payload: BLSPayload = {
    seriesid: seriesIds,
    startyear: startYear,
    endyear: endYear,
  };

  if (env.BLS_API_KEY) {
    payload.registrationkey = env.BLS_API_KEY;
  }

  const response = await withRetry(() => axios.post(BLS_BASE, payload));

  if (response.data.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS API Error: ${response.data.status}`);
  }

  const seriesData = BLSResponseSchema.parse(response.data.Results.series);
  const result: Record<string, DataPoint[]> = {};

  for (const series of seriesData) {
    const points: DataPoint[] = [];
    for (const point of series.data) {
      // Convert period like 'M01' and year '2023' to '2023-01-01'
      let month = '01';
      if (point.period && point.period.startsWith('M')) {
        month = point.period.substring(1);
      } else if (point.period && point.period.startsWith('Q')) {
        const quarter = parseInt(point.period.substring(1), 10);
        month = String((quarter - 1) * 3 + 1).padStart(2, '0');
      }

      const dateStr = `${point.year}-${month}-01`;
      
      const parsed = DataPointSchema.safeParse({
        date: dateStr,
        value: parseFloat(point.value)
      });
      if (parsed.success) {
        points.push(parsed.data);
      }
    }
    // BLS returns latest data first, reverse it to ascending date order
    points.reverse();
    result[series.seriesID] = points;
  }

  return result;
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
  
  if (RAW_BLS_SERIES_IDS.length === 0) return snapshot;

  const currentYear = new Date().getFullYear();
  const startYear = String(currentYear - 2); // Fetch last 3 years to ensure overlap
  const endYear = String(currentYear);

  try {
    const seriesMap = await fetchSeries(RAW_BLS_SERIES_IDS, startYear, endYear);
    for (const seriesId of RAW_BLS_SERIES_IDS) {
      snapshot.series[seriesId] = seriesMap[seriesId] || [];
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  } catch (error) {
    logger.error(error, `Failed to fetch BLS series`);
    for (const seriesId of RAW_BLS_SERIES_IDS) {
      snapshot.series[seriesId] = [];
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  }

  return snapshot;
}

/**
 * Fetches all target series incrementally and updates the SQLite cache.
 * @returns Promise<MacroSnapshot>
 */
export async function updateMacroCache(): Promise<MacroSnapshot> {
  if (RAW_BLS_SERIES_IDS.length === 0) {
    return { series: {}, fetched_at: {} };
  }

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
  
  const currentYear = new Date().getFullYear();
  
  const minStartYear = currentYear - 2;
  let needsFullFetch = false;
  let calculatedStartYear = currentYear;

  for (const seriesId of RAW_BLS_SERIES_IDS) {
    const cachedSeries = snapshot.series[seriesId] || [];
    const lookback = getRevisionLookbackPeriods(seriesId);

    if (cachedSeries.length === 0) {
      needsFullFetch = true;
      break;
    } else {
      const index = Math.max(0, cachedSeries.length - 1 - lookback);
      const seriesStartYear = parseInt(cachedSeries[index].date.substring(0, 4), 10);
      if (seriesStartYear < calculatedStartYear) {
        calculatedStartYear = seriesStartYear;
      }
    }
  }

  const startYear = needsFullFetch ? String(minStartYear) : String(calculatedStartYear);
  const endYear = String(currentYear);

  try {
    const newSeriesMap = await fetchSeries(RAW_BLS_SERIES_IDS, startYear, endYear);

    for (const seriesId of RAW_BLS_SERIES_IDS) {
      const cachedSeries = snapshot.series[seriesId] || [];
      const newPoints = newSeriesMap[seriesId] || [];
      
      // Merge
      const map = new Map<string, DataPoint>();
      for (const p of cachedSeries) map.set(p.date, p);
      for (const p of newPoints) map.set(p.date, p);
      
      const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      
      snapshot.series[seriesId] = merged;
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  } catch (error) {
    logger.error(error, `Failed to fetch BLS series in updateMacroCache`);
    for (const seriesId of RAW_BLS_SERIES_IDS) {
      if (!snapshot.series[seriesId]) {
        snapshot.series[seriesId] = [];
      }
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  }
  
  const cacheData = {
    fetched_at: new Date().toISOString(),
    data: snapshot
  };
  
  db.setCache('macro_snapshot', cacheData);
  return snapshot;
}
