export type IndicatorSource = 'fred' | 'polygon' | 'manual' | 'calculated' | 'bls' | 'eia';
export type IndicatorFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type CalculationOp =
  | { type: 'yoy'; seriesId: string }
  | { type: 'change_pct'; seriesId: string; months: number }
  | { type: 'change_abs'; seriesId: string; months: number }
  | { type: 'qoq_ann_pct'; seriesId: string }
  | { type: 'avg_change'; seriesId: string; periods: number }
  | { type: 'real_yoy'; nominalSeriesId: string; cpiSeriesId: string }
  | { type: 'spread'; leftSeriesId: string; rightSeriesId: string }
  | { type: 'spread_delta_avg'; seriesId: string; periods: number };

export interface IndicatorDefinition {
  key: string;
  name: string;
  description: string;
  unit: string;
  frequency: IndicatorFrequency;
  revision_lookback_periods: number; // Number of past periods to look back for revisions (e.g., 1 for monthly data means we also check the previous month for updates)
  source: IndicatorSource;
  rawSeriesId?: string; // FRED ID or Polygon ticker for fetched series
  dependsOn?: string[]; // raw series IDs this indicator depends on
  calculation?: CalculationOp;
}

export const INDICATORS: Record<string, IndicatorDefinition> = {
  // ── Weighted Inflation Indicators ──────────────────────────────────────────
  cpi_yoy_pct: {
    key: 'cpi_yoy_pct',
    name: 'Consumer Price Index (CPI) YoY',
    description: 'Consumer Price Index (CPI) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['CPIAUCSL'],
    calculation: { type: 'yoy', seriesId: 'CPIAUCSL' },
  },
  pce_yoy_pct: {
    key: 'pce_yoy_pct',
    name: 'Personal Consumption Expenditures (PCE) YoY',
    description: 'Personal Consumption Expenditures (PCE) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['PCEPI'],
    calculation: { type: 'yoy', seriesId: 'PCEPI' },
  },
  breakeven_5y_pct: {
    key: 'breakeven_5y_pct',
    name: '5-Year Breakeven Inflation Rate',
    description: '5-Year Breakeven Inflation Rate (%)',
    unit: '%',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final upon daily close.
    source: 'fred',
    rawSeriesId: 'T5YIE',
  },
  ppi_yoy_pct: {
    key: 'ppi_yoy_pct',
    name: 'Producer Price Index (PPI) YoY',
    description: 'Producer Price Index (PPI) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['PPIACO'],
    calculation: { type: 'yoy', seriesId: 'PPIACO' },
  },
  oil_price_3m_change_pct: {
    key: 'oil_price_3m_change_pct',
    name: 'WTI Crude Oil Price 3-Month % Change',
    description: 'WTI Crude Oil Price 3-Month % Change',
    unit: '% change over prior 90 days',
    frequency: 'daily',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['DCOILWTICO'],
    calculation: { type: 'change_pct', seriesId: 'DCOILWTICO', months: 3 },
  },
  fertilizer_index_3m_change_pct: {
    key: 'fertilizer_index_3m_change_pct',
    name: 'Fertilizer Index 3-Month % Change',
    description: 'Fertilizer Index 3-Month % Change',
    unit: '% YoY',
    revision_lookback_periods: 1, // Manual/Index data; 1 period overlap ensures latest updates are captured.
    frequency: 'monthly',
    source: 'manual',
  },

  // ── Weighted Growth Indicators ─────────────────────────────────────────────
  ism_manufacturing: {
    key: 'ism_manufacturing',
    name: 'ISM Manufacturing PMI',
    description: 'ISM Manufacturing PMI',
    unit: 'index',
    revision_lookback_periods: 1, // ISM is rarely revised month-to-month, but 1 period overlap is safe.
    frequency: 'monthly',
    source: 'manual',
  },
  ism_services: {
    key: 'ism_services',
    name: 'ISM Services PMI',
    description: 'ISM Services PMI',
    unit: 'index',
    revision_lookback_periods: 1, // ISM is rarely revised month-to-month, but 1 period overlap is safe.
    frequency: 'monthly',
    source: 'manual',
  },
  real_gdp_qoq_ann_pct: {
    key: 'real_gdp_qoq_ann_pct',
    name: 'Real GDP Quarter-over-Quarter Annualized',
    description: 'Real GDP Quarter-over-Quarter Annualized % Change',
    unit: '% annualized QoQ',
    frequency: 'quarterly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['GDPC1'],
    calculation: { type: 'qoq_ann_pct', seriesId: 'GDPC1' },
  },
  nfp_3m_avg_k: {
    key: 'nfp_3m_avg_k',
    name: 'Nonfarm Payrolls (NFP) 3-Month Rolling Average',
    description: 'Nonfarm Payrolls 3-Month Rolling Average Change (Thousands)',
    unit: 'thousands (3-month rolling average)',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['PAYEMS'],
    calculation: { type: 'avg_change', seriesId: 'PAYEMS', periods: 3 },
  },
  retail_sales_yoy_real_pct: {
    key: 'retail_sales_yoy_real_pct',
    name: 'Real Retail Sales Year-over-Year (CPI-Adjusted)',
    description: 'Real Retail Sales Year-over-Year % Change (CPI-Adjusted)',
    unit: '% YoY real',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['RSAFS', 'CPIAUCSL'],
    calculation: { type: 'real_yoy', nominalSeriesId: 'RSAFS', cpiSeriesId: 'CPIAUCSL' },
  },

  // ── Supplementary Indicators ────────────────────────────────────────────────
  fed_funds_rate_pct: {
    key: 'fed_funds_rate_pct',
    name: 'Effective Federal Funds Rate',
    description: 'Effective Federal Funds Rate',
    unit: '% effective rate',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily rate data is final upon release.
    source: 'fred',
    rawSeriesId: 'FEDFUNDS',
  },
  yield_2y_pct: {
    key: 'yield_2y_pct',
    name: '2-Year Treasury Yield',
    description: '2-Year Treasury Yield',
    unit: '% nominal',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DGS2',
  },
  yield_10y_pct: {
    key: 'yield_10y_pct',
    name: '10-Year Treasury Yield',
    description: '10-Year Treasury Yield',
    unit: '% nominal',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DGS10',
  },
  yield_30y_pct: {
    key: 'yield_30y_pct',
    name: '30-Year Treasury Yield',
    description: '30-Year Treasury Yield',
    unit: '% nominal',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DGS30',
  },
  tips_real_yield_5y_pct: {
    key: 'tips_real_yield_5y_pct',
    name: '5-Year TIPS Real Yield',
    description: '5-Year Treasury Inflation-Indexed Security, Constant Maturity (TIPS Real Yield)',
    unit: '% real yield',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DFII5',
  },
  yield_curve_10y_2y_bps: {
    key: 'yield_curve_10y_2y_bps',
    name: '10-Year to 2-Year Treasury Spread',
    description: '10-Year to 2-Year Treasury Spread (Yield Curve)',
    unit: 'basis points (10Y minus 2Y)',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'T10Y2Y',
  },
  hy_spread_bps: {
    key: 'hy_spread_bps',
    name: 'High Yield Credit Spread',
    description: 'ICE BofA US High Yield Index Option-Adjusted Spread',
    unit: 'basis points OAS',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'BAMLH0A0HYM2',
  },
  ig_spread_bps: {
    key: 'ig_spread_bps',
    name: 'Investment Grade Credit Spread',
    description: 'ICE BofA US Corporate Index Option-Adjusted Spread',
    unit: 'basis points OAS',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'BAMLC0A0CM',
  },
  usd_index: {
    key: 'usd_index',
    name: 'Nominal Advanced Foreign Economies U.S. Dollar Index',
    description: 'Nominal Advanced Foreign Economies U.S. Dollar Index (DXY Proxy)',
    unit: 'index Jan 2006=100',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DTWEXAFEGS',
  },
  gold_price_usd: {
    key: 'gold_price_usd',
    name: 'Gold Spot Price',
    description: 'Gold Spot Price (XAU/USD)',
    unit: 'USD per troy oz',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'polygon',
    rawSeriesId: 'C:XAUUSD',
  },
  wti_price_usd: {
    key: 'wti_price_usd',
    name: 'Crude Oil Prices: West Texas Intermediate (WTI)',
    description: 'Crude Oil Prices: West Texas Intermediate (WTI)',
    unit: 'USD per barrel',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DCOILWTICO',
  },
  consumer_sentiment: {
    key: 'consumer_sentiment',
    name: 'University of Michigan: Consumer Sentiment',
    description: 'University of Michigan: Consumer Sentiment',
    unit: 'index',
    frequency: 'monthly',
    revision_lookback_periods: 1, // UMich releases Prelim and Final in the same month; 1 period overlap ensures Final is captured.
    source: 'fred',
    rawSeriesId: 'UMCSENT',
  },
  personal_saving_rate_pct: {
    key: 'personal_saving_rate_pct',
    name: 'Personal Saving Rate',
    description: 'Personal Saving Rate',
    unit: '% of disposable income',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Revised alongside PCE and income data over subsequent months.
    source: 'fred',
    rawSeriesId: 'PSAVERT',
  },
  capacity_utilization_pct: {
    key: 'capacity_utilization_pct',
    name: 'Capacity Utilization: Total Industry',
    description: 'Capacity Utilization: Total Industry',
    unit: '% of capacity',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Industrial production and capacity are typically revised for 3 months post-release.
    source: 'fred',
    rawSeriesId: 'CAPUTLG211S',
  },
  real_wages_yoy_pct: {
    key: 'real_wages_yoy_pct',
    name: 'Real Wages YoY % Change',
    description: 'Real Wages Year-over-Year % Change (ECI Wages minus CPI)',
    unit: '% YoY (ECI wages YoY minus CPI YoY)',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['ECIWAG', 'CPIAUCSL'],
    calculation: { type: 'real_yoy', nominalSeriesId: 'ECIWAG', cpiSeriesId: 'CPIAUCSL' },
  },
  fao_food_price_index: {
    key: 'fao_food_price_index',
    name: 'FAO Food Price Index',
    description: 'FAO Food Price Index',
    unit: 'manual',
    revision_lookback_periods: 1, // 1 period overlap for manual index updates.
    frequency: 'monthly',
    source: 'manual',
  },

  // ── Other Indicators / Dependencies ────────────────────────────────────────
  forward_5y5y_pct: {
    key: 'forward_5y5y_pct',
    name: '5-Year, 5-Year Forward Inflation Expectation Rate',
    description: '5-Year, 5-Year Forward Inflation Expectation Rate',
    unit: '% implied annual inflation (5yr fwd, 5yr tenor)',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'T5YIFR',
  },
  yield_curve_30_2: {
    key: 'yield_curve_30_2',
    name: 'Yield Curve Spread: 30Y minus 2Y',
    description: 'Yield Curve Spread: 30Y minus 2Y (Percentage Points)',
    unit: 'percentage points (30Y minus 2Y)',
    frequency: 'daily',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['DGS30', 'DGS2'],
    calculation: { type: 'spread', leftSeriesId: 'DGS30', rightSeriesId: 'DGS2' },
  },
  credit_spread_delta: {
    key: 'credit_spread_delta',
    name: 'High Yield Credit Spread Delta',
    description: 'High Yield Credit Spread Delta (OAS minus 6-Month Moving Average)',
    unit: 'basis points (OAS minus 6-month moving average)',
    frequency: 'daily',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['BAMLH0A0HYM2'],
    calculation: { type: 'spread_delta_avg', seriesId: 'BAMLH0A0HYM2', periods: 6 },
  },
  henry_hub_price_usd: {
    key: 'henry_hub_price_usd',
    name: 'Henry Hub Natural Gas Spot Price',
    description: 'Henry Hub Natural Gas Spot Price',
    unit: 'USD per MMBtu',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DHHNGSP',
  },
  m2_money_supply: {
    key: 'm2_money_supply',
    name: 'M2 Money Supply',
    description: 'M2 Money Supply',
    unit: 'billions of dollars',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Subject to short-term revisions up to 3 months as bank data finalizes.
    source: 'fred',
    rawSeriesId: 'M2SL',
  },
  retail_sales_ex_auto_pct: {
    key: 'retail_sales_ex_auto_pct',
    name: 'Advance Retail Sales: Retail Trade and Food Services (Excl Motor Vehicle & Parts)',
    description: 'Advance Retail Sales: Retail Trade and Food Services (Excl Motor Vehicle & Parts)',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Advance report + 2 subsequent monthly revisions.
    source: 'fred',
    rawSeriesId: 'RSXFS',
  },
  industrial_production_index: {
    key: 'industrial_production_index',
    name: 'Industrial Production Index',
    description: 'Industrial Production Index',
    unit: 'index',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Revised in the subsequent 3 months.
    source: 'fred',
    rawSeriesId: 'INDPRO',
  },
  eia_crude_inventory_change: {
    key: 'eia_crude_inventory_change',
    name: 'EIA Crude Oil Inventory Change',
    description: 'Weekly change in U.S. commercial crude oil inventories',
    unit: 'thousands of barrels',
    frequency: 'weekly',
    revision_lookback_periods: 1, // Physical weekly data is rarely revised retrospectively, but 1 period catches delayed corrections.
    source: 'eia',
    rawSeriesId: 'petroleum/sum/sndw/data/',
  },
  eia_crude_production: {
    key: 'eia_crude_production',
    name: 'EIA U.S. Crude Oil Production',
    description: 'Weekly U.S. field production of crude oil',
    unit: 'thousands of barrels per day',
    frequency: 'weekly',
    revision_lookback_periods: 1, // Same as inventory change.
    source: 'eia',
    rawSeriesId: 'petroleum/crd/crpdn/data/',
  },

  // ── Base Raw Indicators (Source Data) ────────────────────────────────────
  cpi_index: {
    key: 'cpi_index',
    name: 'Consumer Price Index (CPI)',
    description: 'Consumer Price Index for All Urban Consumers: All Items',
    unit: 'Index',
    frequency: 'monthly',
    revision_lookback_periods: 1, // Unadjusted CPI isn't revised month-to-month, but overlapping 1 period prevents timezone/release-time fetch errors.
    source: 'fred',
    rawSeriesId: 'CPIAUCSL',
  },
  pce_index: {
    key: 'pce_index',
    name: 'Personal Consumption Expenditures (PCE)',
    description: 'Personal Consumption Expenditures: Chain-type Price Index',
    unit: 'Index',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Accounts for chained revisions from Retail Sales and GDP updates.
    source: 'fred',
    rawSeriesId: 'PCEPI',
  },
  ppi_index: {
    key: 'ppi_index',
    name: 'Producer Price Index (PPI)',
    description: 'Producer Price Index by Commodity: All Commodities',
    unit: 'Index',
    frequency: 'monthly',
    revision_lookback_periods: 4, // BLS routinely revises PPI up to 4 months post-release.
    source: 'fred',
    rawSeriesId: 'PPIACO',
  },
  real_gdp: {
    key: 'real_gdp',
    name: 'Real GDP',
    description: 'Real Gross Domestic Product',
    unit: 'Billions of Chained 2017 Dollars',
    frequency: 'quarterly',
    revision_lookback_periods: 2, // Covers Advance -> Preliminary -> Final releases.
    source: 'fred',
    rawSeriesId: 'GDPC1',
  },
  nonfarm_payrolls: {
    key: 'nonfarm_payrolls',
    name: 'All Employees, Total Nonfarm',
    description: 'All Employees, Total Nonfarm',
    unit: 'Thousands of Persons',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Initial release + 2 months of establishment survey revisions.
    source: 'fred',
    rawSeriesId: 'PAYEMS',
  },
  retail_sales: {
    key: 'retail_sales',
    name: 'Retail Sales',
    description: 'Advance Retail Sales: Retail Trade and Food Services',
    unit: 'Millions of Dollars',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Advance report + 2 subsequent monthly revisions.
    source: 'fred',
    rawSeriesId: 'RSAFS',
  },
  eci_wages: {
    key: 'eci_wages',
    name: 'Employment Cost Index',
    description: 'Employment Cost Index: Wages and Salaries: Private Industry Workers',
    unit: 'Index',
    frequency: 'quarterly',
    revision_lookback_periods: 1, // ECI is rarely revised retrospectively on a short-term basis, 1 period overlap is safe.
    source: 'fred',
    rawSeriesId: 'ECIWAG',
  },
  core_cpi_index: {
    key: 'core_cpi_index',
    name: 'Core CPI Index',
    description: 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy',
    unit: 'Index',
    frequency: 'monthly',
    revision_lookback_periods: 1, // Same as Headline CPI.
    source: 'fred',
    rawSeriesId: 'CPILFESL',
  },
  core_pce_index: {
    key: 'core_pce_index',
    name: 'Core PCE Index',
    description: 'Personal Consumption Expenditures Excluding Food and Energy',
    unit: 'Index',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Same as Headline PCE.
    source: 'fred',
    rawSeriesId: 'PCEPILFE',
  },
  import_price_index: {
    key: 'import_price_index',
    name: 'Import Price Index',
    description: 'Import Price Index (All Imports)',
    unit: 'Index',
    frequency: 'monthly',
    revision_lookback_periods: 4, // BLS revises import/export prices up to 4 months post-release.
    source: 'fred',
    rawSeriesId: 'IR',
  },
  average_hourly_earnings: {
    key: 'average_hourly_earnings',
    name: 'Average Hourly Earnings',
    description: 'Average Hourly Earnings of All Employees, Total Private',
    unit: 'Dollars per Hour',
    frequency: 'monthly',
    revision_lookback_periods: 3, // Tied directly to NFP establishment survey revisions.
    source: 'fred',
    rawSeriesId: 'CES0500000003',
  },

  // ── Newly Added Indicators ────────────────────────────────────────────────
  core_cpi_yoy_pct: {
    key: 'core_cpi_yoy_pct',
    name: 'Core CPI YoY',
    description: 'Core Consumer Price Index (Ex Food and Energy) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['CPILFESL'],
    calculation: { type: 'yoy', seriesId: 'CPILFESL' },
  },
  core_pce_yoy_pct: {
    key: 'core_pce_yoy_pct',
    name: 'Core PCE YoY',
    description: 'Core Personal Consumption Expenditures (Ex Food and Energy) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['PCEPILFE'],
    calculation: { type: 'yoy', seriesId: 'PCEPILFE' },
  },
  import_price_yoy_pct: {
    key: 'import_price_yoy_pct',
    name: 'Import Price Index YoY',
    description: 'Import Price Index (All Imports) Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['IR'],
    calculation: { type: 'yoy', seriesId: 'IR' },
  },
  ahe_yoy_pct: {
    key: 'ahe_yoy_pct',
    name: 'Average Hourly Earnings YoY',
    description: 'Average Hourly Earnings Year-over-Year % Change',
    unit: '% YoY',
    frequency: 'monthly',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['CES0500000003'],
    calculation: { type: 'yoy', seriesId: 'CES0500000003' },
  },
  initial_claims_4w_avg_k: {
    key: 'initial_claims_4w_avg_k',
    name: 'Initial Jobless Claims (4-Week Average)',
    description: '4-Week Moving Average of Initial Claims (Thousands)',
    unit: 'thousands',
    frequency: 'weekly',
    revision_lookback_periods: 4, // 4 weeks covers late state-level filings and seasonal adjustment tweaks.
    source: 'fred',
    rawSeriesId: 'IC4WSA',
  },
  sloos_net_tightening: {
    key: 'sloos_net_tightening',
    name: 'SLOOS Net Tightening',
    description: 'Net Percentage of Domestic Banks Tightening Standards for C&I Loans',
    unit: '% net tightening',
    frequency: 'quarterly',
    revision_lookback_periods: 1, // SLOOS is usually final upon release, but 1 period overlap ensures capture.
    source: 'fred',
    rawSeriesId: 'DRTSCILM',
  },
  tips_10y_real_yield: {
    key: 'tips_10y_real_yield',
    name: '10-Year TIPS Real Yield',
    description: '10-Year Treasury Inflation-Indexed Security (Real Yield)',
    unit: '% real yield',
    frequency: 'daily',
    revision_lookback_periods: 0, // Daily market data is final.
    source: 'fred',
    rawSeriesId: 'DFII10',
  },
  yield_30y_3m_change_pct: {
    key: 'yield_30y_3m_change_pct',
    name: '30-Year Treasury Yield 3-Month Change',
    description: '30-Year Treasury Yield 3-Month Change in Percentage Points',
    unit: 'percentage points (3-month change)',
    frequency: 'daily',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['DGS30'],
    calculation: { type: 'change_abs', seriesId: 'DGS30', months: 3 },
  },
  usd_index_3m_change_pct: {
    key: 'usd_index_3m_change_pct',
    name: 'USD Index 3-Month % Change',
    description: 'Nominal Advanced Foreign Economies U.S. Dollar Index 3-Month % Change',
    unit: '% change over prior 3 months',
    frequency: 'daily',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['DTWEXAFEGS'],
    calculation: { type: 'change_pct', seriesId: 'DTWEXAFEGS', months: 3 },
  },
  gold_3m_change_pct: {
    key: 'gold_3m_change_pct',
    name: 'Gold 3-Month % Change',
    description: 'Gold Spot Price 3-Month % Change',
    unit: '% change over prior 3 months',
    frequency: 'daily',
    revision_lookback_periods: 0, // Calculated dynamically; lookback is applied to raw dependencies.
    source: 'calculated',
    dependsOn: ['C:XAUUSD'],
    calculation: { type: 'change_pct', seriesId: 'C:XAUUSD', months: 3 },
  },
  nonfarm_labor_productivity_qoq_pct: {
    key: 'nonfarm_labor_productivity_qoq_pct',
    name: 'Nonfarm Labor Productivity QoQ % Change',
    description: 'Nonfarm Labor Productivity Quarter-over-Quarter % Change',
    unit: '% QoQ',
    frequency: 'quarterly',
    revision_lookback_periods: 2, // Matches GDP cycles (Advance -> Preliminary -> Final releases).
    source: 'fred',
    rawSeriesId: 'PRS85006091',
  },
  nonfarm_unit_labor_costs_qoq_pct: {
    key: 'nonfarm_unit_labor_costs_qoq_pct',
    name: 'Nonfarm Unit Labor Costs QoQ % Change',
    description: 'Nonfarm Unit Labor Costs Quarter-over-Quarter % Change',
    unit: '% QoQ',
    frequency: 'quarterly',
    revision_lookback_periods: 2, // Matches GDP and productivity cycles.
    source: 'fred',
    rawSeriesId: 'PRS85006111',
  },
  nonfarm_hours_worked_qoq_pct: {
    key: 'nonfarm_hours_worked_qoq_pct',
    name: 'Nonfarm Hours Worked QoQ % Change',
    description: 'Nonfarm Hours Worked Quarter-over-Quarter % Change',
    unit: '% QoQ',
    frequency: 'quarterly',
    revision_lookback_periods: 2, // Matches revisions that flow through with productivity/payroll updates.
    source: 'fred',
    rawSeriesId: 'PRS85006031',
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
          ids.push(...ind.dependsOn.filter(id => {
            const definedSource = Object.values(INDICATORS).find(i => i.rawSeriesId === id)?.source;
            return !definedSource || definedSource === 'fred';
          }));
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

/**
 * Helper to get the maximum revision lookback periods for a raw series ID.
 */
export function getRevisionLookbackPeriods(seriesId: string): number {
  let maxLookback = 0;
  for (const ind of Object.values(INDICATORS)) {
    if (ind.rawSeriesId === seriesId) {
      if (ind.revision_lookback_periods > maxLookback) {
        maxLookback = ind.revision_lookback_periods;
      }
    }
  }
  return maxLookback;
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

// Raw Polygon Series IDs (e.g. C:XAUUSD for gold spot price)
export const RAW_POLYGON_SERIES_IDS: string[] = Array.from(
  new Set(
    Object.values(INDICATORS)
      .filter((ind) => ind.source === 'polygon' && ind.rawSeriesId)
      .map((ind) => ind.rawSeriesId!)
  )
);
