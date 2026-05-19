import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { DataPoint, DataPointSchema, MacroSnapshot, MacroCacheSchema, MacroIndicators, RawIndicator } from '../../types/index.js';
import { getManualIndicators } from '../../utils/manualIndicators.js';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

export interface SeriesMetadata {
  description: string;
  unit: string;
  source: string;
}

export const TARGET_SERIES: Record<string, SeriesMetadata> = {
  // Inflation
  'CPIAUCSL': {
    description: 'Consumer Price Index (CPI) YoY',
    unit: '% YoY',
    source: 'BLS CUUR0000SA0'
  },
  'PCEPI': {
    description: 'Personal Consumption Expenditures (PCE) YoY',
    unit: '% YoY',
    source: 'BEA'
  },
  'PPIACO': {
    description: 'Producer Price Index (PPI) YoY',
    unit: '% YoY',
    source: 'BLS WPSFD4'
  },
  'T5YIE': {
    description: '5-Year Breakeven Inflation Rate',
    unit: '% implied annual inflation',
    source: 'FRED T5YIE'
  },
  'T5YIFR': {
    description: '5-Year, 5-Year Forward Inflation Expectation Rate',
    unit: '% implied annual inflation (5yr fwd, 5yr tenor)',
    source: 'FRED T5YIFR'
  },
  'ECIWAG': {
    description: 'Employment Cost Index: Wages and Salaries (ECI)',
    unit: '% YoY',
    source: 'BLS ECI'
  },
  'DFII5': {
    description: '5-Year Treasury Inflation-Indexed Security, Constant Maturity (TIPS Real Yield)',
    unit: '% real yield',
    source: 'FRED DFII5'
  },
  // Growth
  'GDPC1': {
    description: 'Real Gross Domestic Product (GDP)',
    unit: '% annualized QoQ',
    source: 'BEA advance estimate'
  },
  'RSAFS': {
    description: 'Advance Real Retail and Food Services Sales',
    unit: '% YoY real (CPI-deflated)',
    source: 'Census / FRED RSAFS deflated by CPI'
  },
  'RSXFS': {
    description: 'Advance Retail Sales: Retail Trade and Food Services (Excl Motor Vehicle & Parts)',
    unit: '% YoY',
    source: 'Census'
  },
  'PAYEMS': {
    description: 'Nonfarm Payrolls (NFP)',
    unit: 'thousands (3-month rolling average)',
    source: 'BLS CES0000000001'
  },
  'INDPRO': {
    description: 'Industrial Production Index',
    unit: 'index',
    source: 'Federal Reserve G.17'
  },
  'CAPUTLG211S': {
    description: 'Capacity Utilization: Total Industry',
    unit: '% of capacity',
    source: 'Federal Reserve G.17'
  },
  'BAMLH0A0HYM2': {
    description: 'ICE BofA US High Yield Index Option-Adjusted Spread',
    unit: 'basis points OAS',
    source: 'ICE BofA US HY / FRED BAMLH0A0HYM2'
  },
  'BAMLC0A0CM': {
    description: 'ICE BofA US Corporate Index Option-Adjusted Spread',
    unit: 'basis points OAS',
    source: 'ICE BofA IG / FRED BAMLC0A0CM'
  },
  'UMCSENT': {
    description: 'University of Michigan: Consumer Sentiment',
    unit: 'index',
    source: 'University of Michigan'
  },
  'PSAVERT': {
    description: 'Personal Saving Rate',
    unit: '% of disposable income',
    source: 'BEA'
  },
  'DCOILWTICO': {
    description: 'Crude Oil Prices: West Texas Intermediate (WTI)',
    unit: 'USD per barrel',
    source: 'EIA'
  },
  'DHHNGSP': {
    description: 'Henry Hub Natural Gas Spot Price',
    unit: 'USD per MMBtu',
    source: 'EIA'
  },
  // Rates & Yield Curve
  'FEDFUNDS': {
    description: 'Effective Federal Funds Rate',
    unit: '% effective rate',
    source: 'FRED EFFR'
  },
  'DGS2': {
    description: '2-Year Treasury Yield',
    unit: '% nominal',
    source: 'FRED DGS2'
  },
  'DGS10': {
    description: '10-Year Treasury Yield',
    unit: '% nominal',
    source: 'FRED DGS10'
  },
  'DGS30': {
    description: '30-Year Treasury Yield',
    unit: '% nominal',
    source: 'FRED DGS30'
  },
  'T10Y2Y': {
    description: '10-Year to 2-Year Treasury Spread (Yield Curve)',
    unit: 'basis points (10Y minus 2Y)',
    source: 'FRED T10Y2Y'
  },
  // Dollar & Liquidity
  'DTWEXBGS': {
    description: 'Trade Weighted U.S. Dollar Index (DXY Proxy)',
    unit: 'index (trade-weighted)',
    source: 'FRED DTWEXBGS'
  },
  'M2SL': {
    description: 'M2 Money Supply',
    unit: 'billions of dollars',
    source: 'Federal Reserve H.6'
  }
};

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

  // Return in chronological order
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
  const seriesIds = Object.keys(TARGET_SERIES);
  
  const promises = seriesIds.map(async (seriesId) => {
    try {
      const data = await fetchSeries(seriesId);
      snapshot.series[seriesId] = data;
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    } catch {
      console.error(`Failed to fetch ${seriesId} (${TARGET_SERIES[seriesId]}):`);
      snapshot.series[seriesId] = []; // Ensure the key exists even on failure
      snapshot.fetched_at[seriesId] = new Date().toISOString();
    }
  });

  await Promise.all(promises);
  return snapshot;
}

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'macroSnapshot.json');

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

  const seriesIds = Object.keys(TARGET_SERIES);
  
  const promises = seriesIds.map(async (seriesId) => {
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
      console.error(`Failed to fetch ${seriesId} (${TARGET_SERIES[seriesId]}):`, error);
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
 * Derives metrics from a macro snapshot for a given base date.
 * This function is used both for the latest data and for backtesting.
 */
export function deriveMetrics(snapshot: MacroSnapshot, baseDate: string = new Date().toISOString()): MacroIndicators {
  const indicators: MacroIndicators = {};
  
  // Helpers
  const getSeriesLatestPoint = (id: string) => {
    const s = snapshot.series[id]?.filter(p => p.date <= baseDate);
    return s && s.length > 0 ? s[s.length - 1] : null;
  };

  const getSeriesValue = (id: string, offset: number = 0) => {
    const s = snapshot.series[id]?.filter(p => p.date <= baseDate);
    return s && s.length > offset ? s[s.length - 1 - offset].value : null;
  };

  const getSeriesValueMonthsAgo = (id: string, months: number) => {
    const s = snapshot.series[id]?.filter(p => p.date <= baseDate);
    if (!s || s.length === 0) return null;
    
    const lastPoint = s[s.length - 1];
    const lastDate = new Date(lastPoint.date);
    const targetDate = new Date(lastDate);
    targetDate.setMonth(targetDate.getMonth() - months);
    const targetStr = targetDate.toISOString().split('T')[0];

    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].date <= targetStr) return s[i].value;
    }
    return s[0].value;
  };

  const calculateYoY = (id: string) => {
    const curr = getSeriesValue(id, 0);
    const prior = getSeriesValueMonthsAgo(id, 12);
    if (curr !== null && prior !== null && prior !== 0) {
      return ((curr - prior) / prior) * 100;
    }
    return null;
  };

  const wrap = (key: string, value: number | null, overrideMetadata?: Partial<RawIndicator> & { description?: string }): RawIndicator | null => {
    if (value === null) return null;
    
    // Default metadata from TARGET_SERIES if available
    const metadata = TARGET_SERIES[key] || { description: key, unit: 'N/A', source: 'unknown' };
    const latestPoint = getSeriesLatestPoint(key);
    
    return {
      value,
      unit: overrideMetadata?.unit ?? metadata.unit,
      description: overrideMetadata?.description ?? metadata.description,
      source: overrideMetadata?.source ?? metadata.source,
      as_of: overrideMetadata?.as_of ?? latestPoint?.date ?? baseDate.split('T')[0],
    };
  };

  // 1. Inflation Metrics
  const cpiYoY = calculateYoY('CPIAUCSL');
  if (cpiYoY !== null) {
    const w = wrap('CPIAUCSL', cpiYoY, { description: 'Consumer Price Index (CPI) Year-over-Year % Change' });
    if (w) indicators['cpi_yoy_pct'] = w;
  }

  const pceYoY = calculateYoY('PCEPI');
  if (pceYoY !== null) {
    const w = wrap('PCEPI', pceYoY, { description: 'Personal Consumption Expenditures (PCE) Year-over-Year % Change' });
    if (w) indicators['pce_yoy_pct'] = w;
  }

  const ppiYoY = calculateYoY('PPIACO');
  if (ppiYoY !== null) {
    const w = wrap('PPIACO', ppiYoY, { description: 'Producer Price Index (PPI) Year-over-Year % Change' });
    if (w) indicators['ppi_yoy_pct'] = w;
  }

  const be5y = getSeriesValue('T5YIE', 0);
  if (be5y !== null) {
    const w = wrap('T5YIE', be5y, { description: '5-Year Breakeven Inflation Rate (%)' });
    if (w) indicators['breakeven_5y_pct'] = w;
  }

  const oilCurr = getSeriesValue('DCOILWTICO', 0);
  const oil3mAgo = getSeriesValueMonthsAgo('DCOILWTICO', 3);
  if (oilCurr !== null && oil3mAgo !== null && oil3mAgo !== 0) {
    const val = ((oilCurr - oil3mAgo) / oil3mAgo) * 100;
    const w = wrap('DCOILWTICO', val, { 
      unit: '% change over prior 90 days',
      description: 'WTI Crude Oil Price 3-Month % Change'
    });
    if (w) indicators['oil_price_3m_change_pct'] = w;
  }

  // 2. Growth Metrics
  const gdpCurr = getSeriesValue('GDPC1', 0);
  const gdpPrior = getSeriesValue('GDPC1', 1); // Quarterly
  if (gdpCurr !== null && gdpPrior !== null && gdpPrior !== 0) {
    const qoq = (gdpCurr - gdpPrior) / gdpPrior;
    const val = (Math.pow(1 + qoq, 4) - 1) * 100;
    const w = wrap('GDPC1', val, { description: 'Real GDP Quarter-over-Quarter Annualized % Change' });
    if (w) indicators['real_gdp_qoq_ann_pct'] = w;
  }

  const nfpSeries = snapshot.series['PAYEMS']?.filter(p => p.date <= baseDate);
  if (nfpSeries && nfpSeries.length >= 4) {
    const changes = [
      nfpSeries[nfpSeries.length - 1].value - nfpSeries[nfpSeries.length - 2].value,
      nfpSeries[nfpSeries.length - 2].value - nfpSeries[nfpSeries.length - 3].value,
      nfpSeries[nfpSeries.length - 3].value - nfpSeries[nfpSeries.length - 4].value,
    ];
    const val = changes.reduce((a, b) => a + b, 0) / 3;
    const w = wrap('PAYEMS', val, { 
      unit: 'thousands (3-month rolling average of monthly NFP)',
      description: 'Nonfarm Payrolls 3-Month Rolling Average Change (Thousands)'
    });
    if (w) indicators['nfp_3m_avg_k'] = w;
  }

  const rsNominalYoY = calculateYoY('RSAFS');
  if (rsNominalYoY !== null && cpiYoY !== null) {
    const val = rsNominalYoY - cpiYoY;
    const w = wrap('RSAFS', val, { description: 'Real Retail Sales Year-over-Year % Change (CPI-Adjusted)' });
    if (w) indicators['retail_sales_yoy_real_pct'] = w;
  }

  const eciYoY = calculateYoY('ECIWAG');
  if (eciYoY !== null && cpiYoY !== null) {
    const val = eciYoY - cpiYoY;
    const w = wrap('ECIWAG', val, { 
      unit: '% YoY (ECI wages YoY minus CPI YoY)',
      description: 'Real Wages Year-over-Year % Change (ECI Wages minus CPI)'
    });
    if (w) indicators['real_wages_yoy_pct'] = w;
  }

  // 3. Keep raw series and other legacy derived metrics
  for (const seriesId of Object.keys(snapshot.series)) {
    const val = getSeriesValue(seriesId, 0);
    if (val !== null) {
      const w = wrap(seriesId, val);
      if (w) indicators[seriesId] = w;
    }
  }

  const y30 = getSeriesValue('DGS30');
  const y2 = getSeriesValue('DGS2');
  if (y30 !== null && y2 !== null) {
    const val = y30 - y2;
    const w = wrap('DGS30', val, { 
      unit: 'percentage points (30Y minus 2Y)',
      description: 'Yield Curve Spread: 30Y minus 2Y (Percentage Points)',
      source: 'Calculated from FRED DGS30, DGS2'
    });
    if (w) indicators['yield_curve_30_2'] = w;
  }

  const hySpread = getSeriesValue('BAMLH0A0HYM2');
  const s = snapshot.series['BAMLH0A0HYM2']?.filter(p => p.date <= baseDate);
  if (hySpread !== null && s && s.length >= 6) {
    const hyAvg6m = s.slice(-6).reduce((sum, p) => sum + p.value, 0) / 6;
    const val = hySpread - hyAvg6m;
    const w = wrap('BAMLH0A0HYM2', val, {
      unit: 'basis points (OAS minus 6-month moving average)',
      description: 'High Yield Credit Spread Delta (OAS minus 6-Month Moving Average)',
      source: 'Calculated from FRED BAMLH0A0HYM2'
    });
    if (w) indicators['credit_spread_delta'] = w;
  }

  // Merge manual indicators (if baseDate is now, or if we have historical manual data)
  const manual = getManualIndicators();
  for (const [key, indicator] of Object.entries(manual)) {
    // Only use manual indicators if they are not newer than baseDate
    if (indicator.updated_at <= baseDate) {
      indicators[key] = {
        value: indicator.value,
        unit: 'manual',
        description: indicator.description,
        source: indicator.source,
        as_of: indicator.period,
      };
    }
  }

  return indicators;
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

