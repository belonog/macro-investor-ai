import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { DataPoint, DataPointSchema, MacroSnapshot, MacroCacheSchema, MacroIndicators } from '../../types/index.js';
import { RAW_FRED_SERIES_IDS, RAW_FRED_METADATA } from '../indicators/registry.js';
import { deriveMetrics } from '../indicators/derivation.js';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';
const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'macroSnapshot.json');

/**
 * Fetches a series from FRED and returns it as an array of DataPoints.
 * @param seriesId The FRED series ID (e.g., 'INDPRO')
 * @param startDate Optional date to start fetching from (YYYY-MM-DD)
 * @returns Promise<DataPoint[]>
 */
export async function fetchSeries(seriesId: string, startDate?: string): Promise<DataPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error('FRED_API_KEY is not set');
  }

  const defaultStartDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const obsStart = startDate || defaultStartDate;

  const response = await axios.get(`${FRED_BASE_URL}/series/observations`, {
    params: {
      series_id: seriesId,
      api_key: apiKey,
      file_type: 'json',
      sort_order: 'asc',
      observation_start: obsStart,
    }
  });

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
      const desc = RAW_FRED_METADATA[seriesId]?.description || seriesId;
      console.error(`Failed to fetch ${seriesId} (${desc})`);
      snapshot.series[seriesId] = []; // Ensure the key exists even on failure
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  });

  await Promise.all(promises);
  return snapshot;
}

/**
 * Fetches all target series incrementally and updates the local JSON cache.
 * @returns Promise<MacroSnapshot>
 */
export async function updateMacroCache(): Promise<MacroSnapshot> {
  let existingSnapshot: MacroSnapshot = { series: {}, fetched_at: {} };
  
  try {
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.safeParse(JSON.parse(rawCache));
    if (parsed.success) {
      existingSnapshot = parsed.data.data;
    }
  } catch {
    // No cache or invalid cache, ignore
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
      const desc = RAW_FRED_METADATA[seriesId]?.description || seriesId;
      console.error(`Failed to fetch ${seriesId} (${desc}):`, error);
      if (!snapshot.series[seriesId]) {
        snapshot.series[seriesId] = [];
      }
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  });

  await Promise.all(promises);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  
  const cacheData = {
    fetched_at: new Date().toISOString(),
    data: snapshot
  };
  
  await fs.writeFile(CACHE_PATH, JSON.stringify(cacheData, null, 2));
  return snapshot;
}

/**
 * Returns the latest single value for each series in the target basket,
 * along with derived trend and spread metrics.
 * Attempts to read from cache first, falls back to fetching.
 * @returns Promise<MacroIndicators>
 */
export async function getLatestValues(): Promise<MacroIndicators> {
  let snapshot: MacroSnapshot;
  try {
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.safeParse(JSON.parse(rawCache));
    if (!parsed.success) {
      console.warn('Invalid macro cache. Re-fetching...');
      snapshot = await updateMacroCache();
    } else {
      snapshot = parsed.data.data;
    }
  } catch {
    snapshot = await updateMacroCache();
  }

  return deriveMetrics(snapshot, new Date().toISOString());
}
