/**
 * Bureau of Labor Statistics (BLS) Data Fetcher.
 * This will eventually fetch data from the BLS API.
 */

import { DataPoint } from '../../types/index.js';

/**
 * Fetches multiple series from BLS.
 * @param seriesIds The BLS series IDs
 * @param startYear Start year for the data
 * @param endYear End year for the data
 * @returns Promise<any[]>
 */
export async function fetchSeries(seriesIds: string[], startYear: string, endYear: string): Promise<any[]> {
  console.log(`BLS Fetcher: Fetching series ${seriesIds.join(', ')} from ${startYear} to ${endYear} (stub)`);
  // Mock data for now
  return [];
}

/**
 * Gets the latest releases from BLS.
 */
export async function getLatestReleases(): Promise<any[]> {
  console.log('BLS Fetcher: Getting latest releases (stub)');
  return [];
}
