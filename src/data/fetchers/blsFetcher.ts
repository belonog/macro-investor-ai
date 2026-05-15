import axios from 'axios';
import { DataPoint } from '../../types/index.js';

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

/**
 * Fetches multiple series from BLS.
 * @param seriesIds The BLS series IDs
 * @param startYear Start year for the data
 * @param endYear End year for the data
 * @returns Promise<any[]>
 */
export async function fetchSeries(seriesIds: string[], startYear: string, endYear: string): Promise<any[]> {
  const payload: any = {
    seriesid: seriesIds,
    startyear: startYear,
    endyear: endYear,
  };

  if (process.env.BLS_API_KEY) {
    payload.registrationkey = process.env.BLS_API_KEY;
  }

  const response = await axios.post(BLS_BASE, payload);

  if (response.data.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS API Error: ${response.data.status}`);
  }

  return response.data.Results.series;
}

/**
 * Gets the latest releases from BLS.
 */
export async function getLatestReleases(): Promise<any[]> {
  const currentYear = new Date().getFullYear().toString();
  const BLS_SERIES = {
    nfp_total: 'CES0000000001',
    cpi_all_urban: 'CUUR0000SA0',
    ppi_final_demand: 'WPSFD4',
  };
  try {
    const seriesData = await fetchSeries(Object.values(BLS_SERIES), currentYear, currentYear);
    return seriesData.map(s => {
      if (s.data && s.data.length > 0) {
        const latest = s.data[0];
        return `Series ${s.seriesID}: ${latest.value} (Period: ${latest.periodName} ${latest.year})`;
      }
      return `Series ${s.seriesID}: No data`;
    });
  } catch (error) {
    console.error('Failed to get BLS latest releases:', error);
    return [];
  }
}
