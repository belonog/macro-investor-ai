export type IndicatorSource = 'fred' | 'polygon' | 'manual' | 'calculated' | 'bls' | 'eia';
export type IndicatorFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface IndicatorDefinition {
  key: string;
  name: string;
  description: string;
  unit: string;
  frequency: IndicatorFrequency;
  source: IndicatorSource;
  rawSeriesId?: string; // FRED ID or Polygon ticker for fetched series
  dependsOn?: string[]; // raw series IDs this indicator depends on
}

export const INDICATORS: Record<string, IndicatorDefinition> = {
  // ── Weighted Inflation Indicators ──────────────────────────────────────────
  cpi_yoy_pct: {
    key: 'cpi_yoy_pct',
    name: 'Consumer Price Index (CPI) YoY',
    description: 'Consumer Price Index (CPI) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    source: 'calculated',
    dependsOn: ['CPIAUCSL']
  },
  pce_yoy_pct: {
    key: 'pce_yoy_pct',
    name: 'Personal Consumption Expenditures (PCE) YoY',
    description: 'Personal Consumption Expenditures (PCE) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    source: 'calculated',
    dependsOn: ['PCEPI']
  },
  breakeven_5y_pct: {
    key: 'breakeven_5y_pct',
    name: '5-Year Breakeven Inflation Rate',
    description: '5-Year Breakeven Inflation Rate (%)',
    unit: '%',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'T5YIE'
  },
  ppi_yoy_pct: {
    key: 'ppi_yoy_pct',
    name: 'Producer Price Index (PPI) YoY',
    description: 'Producer Price Index (PPI) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    source: 'calculated',
    dependsOn: ['PPIACO']
  },
  oil_price_3m_change_pct: {
    key: 'oil_price_3m_change_pct',
    name: 'WTI Crude Oil Price 3-Month % Change',
    description: 'WTI Crude Oil Price 3-Month % Change',
    unit: '% change over prior 90 days',
    frequency: 'daily',
    source: 'calculated',
    dependsOn: ['DCOILWTICO']
  },
  fertilizer_index_3m_change_pct: {
    key: 'fertilizer_index_3m_change_pct',
    name: 'Fertilizer Index 3-Month % Change',
    description: 'Fertilizer Index 3-Month % Change',
    unit: '% YoY',
    frequency: 'monthly',
    source: 'manual'
  },

  // ── Weighted Growth Indicators ─────────────────────────────────────────────
  ism_manufacturing: {
    key: 'ism_manufacturing',
    name: 'ISM Manufacturing PMI',
    description: 'ISM Manufacturing PMI',
    unit: 'index',
    frequency: 'monthly',
    source: 'manual'
  },
  ism_services: {
    key: 'ism_services',
    name: 'ISM Services PMI',
    description: 'ISM Services PMI',
    unit: 'index',
    frequency: 'monthly',
    source: 'manual'
  },
  real_gdp_qoq_ann_pct: {
    key: 'real_gdp_qoq_ann_pct',
    name: 'Real GDP Quarter-over-Quarter Annualized',
    description: 'Real GDP Quarter-over-Quarter Annualized % Change',
    unit: '% annualized QoQ',
    frequency: 'quarterly',
    source: 'calculated',
    dependsOn: ['GDPC1']
  },
  nfp_3m_avg_k: {
    key: 'nfp_3m_avg_k',
    name: 'Nonfarm Payrolls (NFP) 3-Month Rolling Average',
    description: 'Nonfarm Payrolls 3-Month Rolling Average Change (Thousands)',
    unit: 'thousands (3-month rolling average)',
    frequency: 'monthly',
    source: 'calculated',
    dependsOn: ['PAYEMS']
  },
  retail_sales_yoy_real_pct: {
    key: 'retail_sales_yoy_real_pct',
    name: 'Real Retail Sales Year-over-Year (CPI-Adjusted)',
    description: 'Real Retail Sales Year-over-Year % Change (CPI-Adjusted)',
    unit: '% YoY real',
    frequency: 'monthly',
    source: 'calculated',
    dependsOn: ['RSAFS', 'CPIAUCSL']
  },

  // ── Supplementary Indicators ────────────────────────────────────────────────
  fed_funds_rate_pct: {
    key: 'fed_funds_rate_pct',
    name: 'Effective Federal Funds Rate',
    description: 'Effective Federal Funds Rate',
    unit: '% effective rate',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'FEDFUNDS'
  },
  yield_2y_pct: {
    key: 'yield_2y_pct',
    name: '2-Year Treasury Yield',
    description: '2-Year Treasury Yield',
    unit: '% nominal',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'DGS2'
  },
  yield_10y_pct: {
    key: 'yield_10y_pct',
    name: '10-Year Treasury Yield',
    description: '10-Year Treasury Yield',
    unit: '% nominal',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'DGS10'
  },
  yield_30y_pct: {
    key: 'yield_30y_pct',
    name: '30-Year Treasury Yield',
    description: '30-Year Treasury Yield',
    unit: '% nominal',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'DGS30'
  },
  tips_real_yield_5y_pct: {
    key: 'tips_real_yield_5y_pct',
    name: '5-Year TIPS Real Yield',
    description: '5-Year Treasury Inflation-Indexed Security, Constant Maturity (TIPS Real Yield)',
    unit: '% real yield',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'DFII5'
  },
  yield_curve_10y_2y_bps: {
    key: 'yield_curve_10y_2y_bps',
    name: '10-Year to 2-Year Treasury Spread',
    description: '10-Year to 2-Year Treasury Spread (Yield Curve)',
    unit: 'basis points (10Y minus 2Y)',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'T10Y2Y'
  },
  hy_spread_bps: {
    key: 'hy_spread_bps',
    name: 'High Yield Credit Spread',
    description: 'ICE BofA US High Yield Index Option-Adjusted Spread',
    unit: 'basis points OAS',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'BAMLH0A0HYM2'
  },
  ig_spread_bps: {
    key: 'ig_spread_bps',
    name: 'Investment Grade Credit Spread',
    description: 'ICE BofA US Corporate Index Option-Adjusted Spread',
    unit: 'basis points OAS',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'BAMLC0A0CM'
  },
  dxy: {
    key: 'dxy',
    name: 'Trade Weighted U.S. Dollar Index',
    description: 'Trade Weighted U.S. Dollar Index (DXY Proxy)',
    unit: 'index (trade-weighted)',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'DTWEXBGS'
  },
  gold_price_usd: {
    key: 'gold_price_usd',
    name: 'Gold Spot Price',
    description: 'Gold Spot Price (XAU/USD)',
    unit: 'USD per troy oz',
    frequency: 'daily',
    source: 'polygon',
    rawSeriesId: 'C:XAUUSD'
  },
  wti_price_usd: {
    key: 'wti_price_usd',
    name: 'Crude Oil Prices: West Texas Intermediate (WTI)',
    description: 'Crude Oil Prices: West Texas Intermediate (WTI)',
    unit: 'USD per barrel',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'DCOILWTICO'
  },
  consumer_sentiment: {
    key: 'consumer_sentiment',
    name: 'University of Michigan: Consumer Sentiment',
    description: 'University of Michigan: Consumer Sentiment',
    unit: 'index',
    frequency: 'monthly',
    source: 'fred',
    rawSeriesId: 'UMCSENT'
  },
  personal_saving_rate_pct: {
    key: 'personal_saving_rate_pct',
    name: 'Personal Saving Rate',
    description: 'Personal Saving Rate',
    unit: '% of disposable income',
    frequency: 'monthly',
    source: 'fred',
    rawSeriesId: 'PSAVERT'
  },
  capacity_utilization_pct: {
    key: 'capacity_utilization_pct',
    name: 'Capacity Utilization: Total Industry',
    description: 'Capacity Utilization: Total Industry',
    unit: '% of capacity',
    frequency: 'monthly',
    source: 'fred',
    rawSeriesId: 'CAPUTLG211S'
  },
  real_wages_yoy_pct: {
    key: 'real_wages_yoy_pct',
    name: 'Real Wages YoY % Change',
    description: 'Real Wages Year-over-Year % Change (ECI Wages minus CPI)',
    unit: '% YoY (ECI wages YoY minus CPI YoY)',
    frequency: 'monthly',
    source: 'calculated',
    dependsOn: ['ECIWAG', 'CPIAUCSL']
  },
  fao_food_price_index: {
    key: 'fao_food_price_index',
    name: 'FAO Food Price Index',
    description: 'FAO Food Price Index',
    unit: 'manual',
    frequency: 'monthly',
    source: 'manual'
  },

  // ── Other Indicators / Dependencies ────────────────────────────────────────
  forward_5y5y_pct: {
    key: 'forward_5y5y_pct',
    name: '5-Year, 5-Year Forward Inflation Expectation Rate',
    description: '5-Year, 5-Year Forward Inflation Expectation Rate',
    unit: '% implied annual inflation (5yr fwd, 5yr tenor)',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'T5YIFR'
  },
  yield_curve_30_2: {
    key: 'yield_curve_30_2',
    name: 'Yield Curve Spread: 30Y minus 2Y',
    description: 'Yield Curve Spread: 30Y minus 2Y (Percentage Points)',
    unit: 'percentage points (30Y minus 2Y)',
    frequency: 'daily',
    source: 'calculated',
    dependsOn: ['DGS30', 'DGS2']
  },
  credit_spread_delta: {
    key: 'credit_spread_delta',
    name: 'High Yield Credit Spread Delta',
    description: 'High Yield Credit Spread Delta (OAS minus 6-Month Moving Average)',
    unit: 'basis points (OAS minus 6-month moving average)',
    frequency: 'daily',
    source: 'calculated',
    dependsOn: ['BAMLH0A0HYM2']
  },
  henry_hub_price_usd: {
    key: 'henry_hub_price_usd',
    name: 'Henry Hub Natural Gas Spot Price',
    description: 'Henry Hub Natural Gas Spot Price',
    unit: 'USD per MMBtu',
    frequency: 'daily',
    source: 'fred',
    rawSeriesId: 'DHHNGSP'
  },
  m2_money_supply: {
    key: 'm2_money_supply',
    name: 'M2 Money Supply',
    description: 'M2 Money Supply',
    unit: 'billions of dollars',
    frequency: 'monthly',
    source: 'fred',
    rawSeriesId: 'M2SL'
  },
  retail_sales_ex_auto_pct: {
    key: 'retail_sales_ex_auto_pct',
    name: 'Advance Retail Sales: Retail Trade and Food Services (Excl Motor Vehicle & Parts)',
    description: 'Advance Retail Sales: Retail Trade and Food Services (Excl Motor Vehicle & Parts)',
    unit: '% YoY',
    frequency: 'monthly',
    source: 'fred',
    rawSeriesId: 'RSXFS'
  },
  industrial_production_index: {
    key: 'industrial_production_index',
    name: 'Industrial Production Index',
    description: 'Industrial Production Index',
    unit: 'index',
    frequency: 'monthly',
    source: 'fred',
    rawSeriesId: 'INDPRO'
  },
  eia_crude_inventory_change: {
    key: 'eia_crude_inventory_change',
    name: 'EIA Crude Oil Inventory Change',
    description: 'Weekly change in U.S. commercial crude oil inventories',
    unit: 'thousands of barrels',
    frequency: 'weekly',
    source: 'eia',
    rawSeriesId: 'petroleum/sum/sndw/data/'
  },
  eia_crude_production: {
    key: 'eia_crude_production',
    name: 'EIA U.S. Crude Oil Production',
    description: 'Weekly U.S. field production of crude oil',
    unit: 'thousands of barrels per day',
    frequency: 'weekly',
    source: 'eia',
    rawSeriesId: 'petroleum/crd/crpdn/data/'
  }
};

// Raw FRED Series IDs that need to be fetched/cached
export const RAW_FRED_SERIES_IDS: string[] = Array.from(
  new Set(
    Object.values(INDICATORS)
      .flatMap((ind) => {
        const ids: string[] = [];
        if (ind.source === 'fred' && ind.rawSeriesId) {
          ids.push(ind.rawSeriesId);
        }
        if (ind.dependsOn) {
          ids.push(...ind.dependsOn);
        }
        return ids;
      })
  )
);

/**
 * Helper to get a human-readable description for any raw series ID,
 * derived directly from the INDICATORS map.
 */
export function getRawSeriesDescription(seriesId: string): string {
  for (const ind of Object.values(INDICATORS)) {
    if (ind.rawSeriesId === seriesId) return ind.description;
    if (ind.dependsOn?.includes(seriesId)) return ind.description;
  }
  return seriesId;
}

// Raw BLS Series IDs
export const RAW_BLS_SERIES_IDS: string[] = Array.from(
  new Set(
    Object.values(INDICATORS)
      .filter((ind) => ind.source === 'bls' && ind.rawSeriesId)
      .map((ind) => ind.rawSeriesId!)
  )
);

// Raw EIA Series IDs
export const RAW_EIA_SERIES_IDS: string[] = Array.from(
  new Set(
    Object.values(INDICATORS)
      .filter((ind) => ind.source === 'eia' && ind.rawSeriesId)
      .map((ind) => ind.rawSeriesId!)
  )
);
