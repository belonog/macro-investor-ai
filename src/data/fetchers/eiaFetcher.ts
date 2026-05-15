/**
 * Energy Information Administration (EIA) Data Fetcher.
 * This will eventually fetch data from the EIA API.
 */

/**
 * Gets the current crude oil price (WTI).
 */
export async function getCrudeOilPrice(): Promise<number> {
  console.log('EIA Fetcher: Getting Crude Oil Price (stub)');
  return 0;
}

/**
 * Gets the current natural gas price (Henry Hub).
 */
export async function getNatGasPrice(): Promise<number> {
  console.log('EIA Fetcher: Getting Nat Gas Price (stub)');
  return 0;
}

/**
 * Gets the latest crude inventory change.
 */
export async function getCrudeInventoryChange(): Promise<number> {
  console.log('EIA Fetcher: Getting Crude Inventory Change (stub)');
  return 0;
}

/**
 * Gets all latest values from EIA.
 */
export async function getLatest(): Promise<Record<string, number>> {
  return {
    crude_oil_price: await getCrudeOilPrice(),
    nat_gas_price: await getNatGasPrice(),
    crude_inventory_change: await getCrudeInventoryChange(),
  };
}
