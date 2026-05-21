import axios from 'axios';
import { DataPoint, DataPointSchema, MacroSnapshot, MacroCacheSchema } from '../../types/index.js';
import { RAW_EIA_SERIES_IDS, getRawSeriesDescription } from '../indicators/registry.js';
import { logger } from '../../utils/logger.js';
import { db } from '../../db/database.js';
import { env } from '../../config/env.js';
import { withRetry } from '../../utils/retry.js';

const EIA_BASE = 'https://api.eia.gov/v2';

/**
 * Fetches multiple series from EIA and converts them to a map of seriesId -> DataPoint[].
 * @param seriesIds The EIA series IDs (api paths)
 * @returns Promise<Record<string, DataPoint[]>>
 */
export async function fetchSeries(seriesIds: string[]): Promise<Record<string, DataPoint[]>> {
  if (seriesIds.length === 0) return {};

  const result: Record<string, DataPoint[]> = {};

  const promises = seriesIds.map(async (apiPath) => {
    try {
      const url = `${EIA_BASE}${apiPath.startsWith('/') ? apiPath : '/' + apiPath}`;
      const response = await withRetry(() => axios.get(url, {
        params: { api_key: env.EIA_API_KEY }
      }));

      const points: DataPoint[] = [];
      const data = response.data?.response?.data || [];
      
      for (const row of data) {
        if (row.period && row.value !== undefined && row.value !== null) {
          const parsed = DataPointSchema.safeParse({
            date: row.period,
            value: parseFloat(row.value)
          });
          if (parsed.success) {
            points.push(parsed.data);
          }
        }
      }
      
      // EIA data is usually latest first. Reverse it to ascending date order
      points.sort((a, b) => a.date.localeCompare(b.date));
      result[apiPath] = points;
    } catch (error) {
      const desc = getRawSeriesDescription(apiPath);
      logger.error(error, `Failed to fetch EIA series ${apiPath} (${desc})`);
      result[apiPath] = [];
    }
  });

  await Promise.all(promises);
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
  
  if (RAW_EIA_SERIES_IDS.length === 0) return snapshot;

  const seriesMap = await fetchSeries(RAW_EIA_SERIES_IDS);
  
  for (const seriesId of RAW_EIA_SERIES_IDS) {
    snapshot.series[seriesId] = seriesMap[seriesId] || [];
    snapshot.fetched_at[seriesId] = new Date().toISOString();
  }

  return snapshot;
}

/**
 * Fetches all target series incrementally and updates the SQLite cache.
 * @returns Promise<MacroSnapshot>
 */
export async function updateMacroCache(): Promise<MacroSnapshot> {
  if (RAW_EIA_SERIES_IDS.length === 0) {
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
  
  const newSeriesMap = await fetchSeries(RAW_EIA_SERIES_IDS);

  for (const seriesId of RAW_EIA_SERIES_IDS) {
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
  
  const cacheData = {
    fetched_at: new Date().toISOString(),
    data: snapshot
  };
  
  db.setCache('macro_snapshot', cacheData);
  return snapshot;
}
