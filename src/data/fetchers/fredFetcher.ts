import axios from 'axios';
import { DataPoint, DataPointSchema } from '../types.js';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

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
