import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { DataPoint, DataPointSchema, MacroSnapshot, MacroCacheSchema } from '../types.js';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

export const TARGET_SERIES = [
  'T10Y2Y', 'ICSA', 'HOUST', 'AMDMNO', 'NFCI', // Leading
  'INDPRO', 'PAYEMS', 'PCEPILFE'              // Confirmation
];

/**
 * Fetches a series from FRED and returns it as an array of DataPoints.
 * @param seriesId The FRED series ID (e.g., 'INDPRO')
 * @param limit Number of observations to fetch (default 12)
 * @returns Promise<DataPoint[]>
 */
export async function fetchSeries(seriesId: string, limit: number = 12): Promise<DataPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error('FRED_API_KEY is not set');
  }

  const response = await axios.get(`${FRED_BASE_URL}/series/observations`, {
    params: {
      series_id: seriesId,
      api_key: apiKey,
      file_type: 'json',
      sort_order: 'desc',
      limit: limit,
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

  // Return in chronological order
  return points.reverse();
}

/**
 * Fetches all target series concurrently.
 * @param periods Number of observations to fetch for each series
 * @returns Promise<MacroSnapshot>
 */
export async function fetchAll(periods: number = 12): Promise<MacroSnapshot> {
  const snapshot: MacroSnapshot = {};
  
  const promises = TARGET_SERIES.map(async (seriesId) => {
    try {
      const data = await fetchSeries(seriesId, periods);
      snapshot[seriesId] = data;
    } catch (error) {
      console.error(`Failed to fetch ${seriesId}:`, error);
      snapshot[seriesId] = []; // Ensure the key exists even on failure
    }
  });

  await Promise.all(promises);
  return snapshot;
}

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'macroSnapshot.json');

/**
 * Fetches all target series and updates the local JSON cache.
 * @param periods Number of observations to fetch
 * @returns Promise<MacroSnapshot>
 */
export async function updateMacroCache(periods: number = 12): Promise<MacroSnapshot> {
  const snapshot = await fetchAll(periods);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  
  const cacheData = {
    fetchedAt: new Date().toISOString(),
    data: snapshot
  };
  
  await fs.writeFile(CACHE_PATH, JSON.stringify(cacheData, null, 2));
  return snapshot;
}

/**
 * Returns the latest single value for each series in the target basket.
 * Attempts to read from cache first, falls back to fetching.
 * @returns Promise<Record<string, number>>
 */
export async function getLatestValues(): Promise<Record<string, number>> {
  let snapshot: MacroSnapshot;
  try {
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.safeParse(JSON.parse(rawCache));
    if (!parsed.success) {
      console.warn('Invalid macro cache format. Re-fetching...');
      snapshot = await updateMacroCache(1);
    } else {
      snapshot = parsed.data.data;
    }
  } catch (e) {
    // If no cache or parse error, fetch it
    snapshot = await updateMacroCache(1);
  }

  const latest: Record<string, number> = {};
  for (const [series, points] of Object.entries(snapshot)) {
    if (points.length > 0) {
      latest[series] = points[points.length - 1].value;
    }
  }
  return latest;
}
