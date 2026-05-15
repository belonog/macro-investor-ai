import axios from 'axios';

const EIA_BASE = 'https://api.eia.gov/v2';

async function fetchEiaValue(apiPath: string): Promise<number> {
  const url = `${EIA_BASE}${apiPath}`;
  const response = await axios.get(url, {
    params: { api_key: process.env.EIA_API_KEY }
  });
  return response.data.response.data[0].value;
}

/**
 * Gets the latest crude inventory change.
 */
export async function getCrudeInventoryChange(): Promise<number> {
  return fetchEiaValue('/petroleum/sum/sndw/data/');
}

/**
 * Gets the latest US crude oil field production.
 */
export async function getCrudeProduction(): Promise<number> {
  return fetchEiaValue('/petroleum/crd/crpdn/data/');
}

/**
 * Gets all latest fundamental values from EIA.
 */
export async function getLatest(): Promise<Record<string, number>> {
  return {
    crude_inventory_change: await getCrudeInventoryChange(),
    crude_production: await getCrudeProduction(),
  };
}
