import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { DataPoint, DataPointSchema, MacroSnapshot, MacroCacheSchema } from '../../types/index.js';
import { getManualIndicators } from '../../utils/manualIndicators.js';

/**
 * Helper for calculating percentage change.
 */ 
function calculateGrowth(current: number, past: number): number {
  return past === 0 ? 0 : (current - past) / past;
}

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

export const TARGET_SERIES: Record<string, string> = {
  // Inflation
  'CPIAUCSL': 'Consumer Price Index (CPI) YoY',
  'PCEPI': 'Personal Consumption Expenditures (PCE) YoY',
  'PPIACO': 'Producer Price Index (PPI) YoY',
  'T5YIE': '5-Year Breakeven Inflation Rate',
  'T5YIFR': '5-Year, 5-Year Forward Inflation Expectation Rate',
  'ECIWAG': 'Employment Cost Index: Wages and Salaries (ECI)',
  'DFII5': '5-Year Treasury Inflation-Indexed Security, Constant Maturity (TIPS Real Yield)',
  // Growth
  'GDPC1': 'Real Gross Domestic Product (GDP)',
  'RSAFS': 'Advance Real Retail and Food Services Sales',
  'RSXFS': 'Advance Retail Sales: Retail Trade and Food Services (Excl Motor Vehicle & Parts)',
  'PAYEMS': 'Nonfarm Payrolls (NFP)',
  'INDPRO': 'Industrial Production Index',
  'CAPUTLG211S': 'Capacity Utilization: Total Industry',
  'BAMLH0A0HYM2': 'ICE BofA US High Yield Index Option-Adjusted Spread',
  'BAMLC0A0CM': 'ICE BofA US Corporate Index Option-Adjusted Spread',
  'UMCSENT': 'University of Michigan: Consumer Sentiment',
  'PSAVERT': 'Personal Saving Rate',
  'DCOILWTICO': 'Crude Oil Prices: West Texas Intermediate (WTI)',
  'DHHNGSP': 'Henry Hub Natural Gas Spot Price',
  // Rates & Yield Curve
  'FEDFUNDS': 'Effective Federal Funds Rate',
  'DGS2': '2-Year Treasury Yield',
  'DGS10': '10-Year Treasury Yield',
  'DGS30': '30-Year Treasury Yield',
  'T10Y2Y': '10-Year to 2-Year Treasury Spread (Yield Curve)',
  // Dollar & Liquidity
  'DTWEXBGS': 'Trade Weighted U.S. Dollar Index (DXY Proxy)',
  'M2SL': 'M2 Money Supply'
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
    fetchedAt: {}
  };
  const seriesIds = Object.keys(TARGET_SERIES);
  
  const promises = seriesIds.map(async (seriesId) => {
    try {
      const data = await fetchSeries(seriesId);
      snapshot.series[seriesId] = data;
      snapshot.fetchedAt[seriesId] = new Date().toISOString();
    } catch (error) {
      console.error(`Failed to fetch ${seriesId} (${TARGET_SERIES[seriesId]}):`, error);
      snapshot.series[seriesId] = []; // Ensure the key exists even on failure
      snapshot.fetchedAt[seriesId] = new Date().toISOString();
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
  let existingSnapshot: MacroSnapshot = { series: {}, fetchedAt: {} };
  
  try {
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.safeParse(JSON.parse(rawCache));
    if (parsed.success) {
      existingSnapshot = parsed.data.data;
    }
  } catch (e) {
    // No cache or invalid cache, ignore
  }

  const snapshot: MacroSnapshot = {
    series: { ...existingSnapshot.series },
    fetchedAt: { ...existingSnapshot.fetchedAt }
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
      snapshot.fetchedAt[seriesId] = new Date().toISOString();
    } catch (error) {
      console.error(`Failed to fetch ${seriesId} (${TARGET_SERIES[seriesId]}):`, error);
      if (!snapshot.series[seriesId]) {
        snapshot.series[seriesId] = [];
      }
      snapshot.fetchedAt[seriesId] = new Date().toISOString();
    }
  });

  await Promise.all(promises);
  
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
 * Returns the latest single value for each series in the target basket,
 * along with derived trend and spread metrics.
 * Attempts to read from cache first, falls back to fetching.
 * @returns Promise<Record<string, number>>
 */
export async function getLatestValues(): Promise<Record<string, number>> {
  let snapshot: MacroSnapshot;
  try {
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.safeParse(JSON.parse(rawCache));
    // We need at least 7 points for 6m average + current, but we guarantee at least 1 year
    if (!parsed.success) {
      console.warn('Invalid macro cache. Re-fetching...');
      snapshot = await updateMacroCache();
    } else {
      snapshot = parsed.data.data;
    }
  } catch (e) {
    // If no cache or parse error, fetch it
    snapshot = await updateMacroCache();
  }

  const latest: Record<string, number> = {};
  
  // Basic series
  for (const [series, points] of Object.entries(snapshot.series)) {
    if (points.length > 0) {
      latest[series] = points[points.length - 1].value;
    }
  }

  // Derived metrics helper
  const getSeriesValue = (id: string, offset: number = 0) => {
    const s = snapshot.series[id];
    return s && s.length > offset ? s[s.length - 1 - offset].value : null;
  };

  const getSeriesAvg = (id: string, window: number) => {
    const s = snapshot.series[id];
    if (!s || s.length < window) return null;
    const slice = s.slice(-window);
    return slice.reduce((sum, p) => sum + p.value, 0) / window;
  };

  // oil_price_3m_change: % change in WTI crude over prior 3 months
  const oilCurr = getSeriesValue('DCOILWTICO');
  const oilPrior = getSeriesValue('DCOILWTICO', 3);
  if (oilCurr !== null && oilPrior !== null && oilPrior !== 0) {
    latest['oil_price_3m_change'] = (oilCurr - oilPrior) / oilPrior;
  }

  // nfp_3m_avg: rolling 3-month average of NFP additions
  const nfp = snapshot.series['PAYEMS'];
  if (nfp && nfp.length >= 4) {
    const changes = [
      nfp[nfp.length - 1].value - nfp[nfp.length - 2].value,
      nfp[nfp.length - 2].value - nfp[nfp.length - 3].value,
      nfp[nfp.length - 3].value - nfp[nfp.length - 4].value,
    ];
    latest['nfp_3m_avg'] = changes.reduce((a, b) => a + b, 0) / 3;
  }

  // cpi_yoy: 12-month change
  const cpiCurr = getSeriesValue('CPIAUCSL');
  const cpiPrior = getSeriesValue('CPIAUCSL', 12);
  if (cpiCurr !== null && cpiPrior !== null) {
    latest['cpi_yoy'] = calculateGrowth(cpiCurr, cpiPrior);
  }

  // pce_yoy: 12-month change
  const pceCurr = getSeriesValue('PCEPI');
  const pcePrior = getSeriesValue('PCEPI', 12);
  if (pceCurr !== null && pcePrior !== null) {
    latest['pce_yoy'] = calculateGrowth(pceCurr, pcePrior);
  }

  // real_gdp_qoq: 1-quarter change
  const gdpCurr = getSeriesValue('GDPC1');
  const gdpPrior = getSeriesValue('GDPC1', 1);
  if (gdpCurr !== null && gdpPrior !== null) {
    latest['real_gdp_qoq'] = calculateGrowth(gdpCurr, gdpPrior);
  }

  // yield_curve_30_2: 30-Year Treasury Yield - 2-Year Treasury Yield
  const y30 = getSeriesValue('DGS30');
  const y2 = getSeriesValue('DGS2');
  if (y30 !== null && y2 !== null) {
    latest['yield_curve_30_2'] = y30 - y2;
  }

  // credit_spread_delta: HY OAS current - 6m average
  const hySpread = getSeriesValue('BAMLH0A0HYM2');
  const hyAvg6m = getSeriesAvg('BAMLH0A0HYM2', 6);
  if (hySpread !== null && hyAvg6m !== null) {
    latest['credit_spread_delta'] = hySpread - hyAvg6m;
  }

  // Merge manual indicators
  const manual = getManualIndicators();
  for (const [key, indicator] of Object.entries(manual)) {
    latest[key] = indicator.value;
  }

  return latest;
}
