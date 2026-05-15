# Incremental FRED Fetching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/data/fetchers/fredFetcher.ts` to implement frequency-based limits and incremental fetching from `macroSnapshot.json` cache.

**Architecture:** Use a series-to-frequency mapping to determine fetch limits and history retention. Load existing cache, fetch only new data points using `observation_start`, and merge with existing data while maintaining sorted order and preventing duplicates.

**Tech Stack:** TypeScript, Axios, Zod, Node.js FS.

---

### Task 1: Define Frequency and Limit Mappings

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Define `SERIES_CONFIG` with frequency and limits**

```typescript
export interface SeriesConfig {
  id: string;
  name: string;
  frequency: 'daily' | 'monthly' | 'quarterly';
  requiredCount: number; // For 15 months
  maxCount: number;      // 2x requiredCount
}

export const SERIES_CONFIG: Record<string, SeriesConfig> = {
  // Inflation
  'CPIAUCSL': { id: 'CPIAUCSL', name: 'Consumer Price Index (CPI) YoY', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'PCEPI': { id: 'PCEPI', name: 'Personal Consumption Expenditures (PCE) YoY', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'PPIACO': { id: 'PPIACO', name: 'Producer Price Index (PPI) YoY', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'T5YIE': { id: 'T5YIE', name: '5-Year Breakeven Inflation Rate', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'T5YIFR': { id: 'T5YIFR', name: '5-Year, 5-Year Forward Inflation Expectation Rate', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'ECIWAG': { id: 'ECIWAG', name: 'Employment Cost Index: Wages and Salaries (ECI)', frequency: 'quarterly', requiredCount: 6, maxCount: 12 },
  'DFII5': { id: 'DFII5', name: '5-Year Treasury Inflation-Indexed Security, Constant Maturity (TIPS Real Yield)', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  // Growth
  'GDPC1': { id: 'GDPC1', name: 'Real Gross Domestic Product (GDP)', frequency: 'quarterly', requiredCount: 6, maxCount: 12 },
  'RSAFS': { id: 'RSAFS', name: 'Advance Real Retail and Food Services Sales', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'RSXFS': { id: 'RSXFS', name: 'Advance Retail Sales: Retail Trade and Food Services (Excl Motor Vehicle & Parts)', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'PAYEMS': { id: 'PAYEMS', name: 'Nonfarm Payrolls (NFP)', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'INDPRO': { id: 'INDPRO', name: 'Industrial Production Index', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'CAPUTLG211S': { id: 'CAPUTLG211S', name: 'Capacity Utilization: Total Industry', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'BAMLH0A0HYM2': { id: 'BAMLH0A0HYM2', name: 'ICE BofA US High Yield Index Option-Adjusted Spread', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'BAMLC0A0CM': { id: 'BAMLC0A0CM', name: 'ICE BofA US Corporate Index Option-Adjusted Spread', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'UMCSENT': { id: 'UMCSENT', name: 'University of Michigan: Consumer Sentiment', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'PSAVERT': { id: 'PSAVERT', name: 'Personal Saving Rate', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'DCOILWTICO': { id: 'DCOILWTICO', name: 'Crude Oil Prices: West Texas Intermediate (WTI)', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  // Rates & Yield Curve
  'FEDFUNDS': { id: 'FEDFUNDS', name: 'Effective Federal Funds Rate', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'DGS2': { id: 'DGS2', name: '2-Year Treasury Yield', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'DGS10': { id: 'DGS10', name: '10-Year Treasury Yield', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'DGS30': { id: 'DGS30', name: '30-Year Treasury Yield', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'T10Y2Y': { id: 'T10Y2Y', name: '10-Year to 2-Year Treasury Spread (Yield Curve)', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  // Dollar & Liquidity
  'DTWEXBGS': { id: 'DTWEXBGS', name: 'Trade Weighted U.S. Dollar Index (DXY Proxy)', frequency: 'daily', requiredCount: 330, maxCount: 660 },
  'M2SL': { id: 'M2SL', name: 'M2 Money Supply', frequency: 'monthly', requiredCount: 15, maxCount: 30 },
  'GOLDAMGBD228NLBM': { id: 'GOLDAMGBD228NLBM', name: 'Gold Fixing Price 10:30 A.M. (London time) in London Bullion Market', frequency: 'daily', requiredCount: 330, maxCount: 660 }
};
```

- [ ] **Step 2: Update `TARGET_SERIES` to be derived from `SERIES_CONFIG`**

```typescript
export const TARGET_SERIES: Record<string, string> = Object.fromEntries(
  Object.entries(SERIES_CONFIG).map(([id, config]) => [id, config.name])
);
```

### Task 2: Implement Incremental Fetching in `fetchSeries`

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Refactor `fetchSeries` to support `observation_start`**

```typescript
/**
 * Fetches a series from FRED and returns it as an array of DataPoints.
 * @param seriesId The FRED series ID (e.g., 'INDPRO')
 * @param startDate Optional start date for fetching observations (YYYY-MM-DD)
 * @param limit Optional limit for the number of observations to fetch
 * @returns Promise<DataPoint[]>
 */
export async function fetchSeries(seriesId: string, startDate?: string, limit?: number): Promise<DataPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error('FRED_API_KEY is not set');
  }

  const params: Record<string, any> = {
    series_id: seriesId,
    api_key: apiKey,
    file_type: 'json',
    sort_order: 'desc',
  };

  if (startDate) {
    params.observation_start = startDate;
  }
  if (limit) {
    params.limit = limit;
  } else if (!startDate) {
    // If no startDate and no limit, use requiredCount as default
    params.limit = SERIES_CONFIG[seriesId]?.requiredCount || 12;
  }

  const response = await axios.get(`${FRED_BASE_URL}/series/observations`, { params });

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
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
```

### Task 3: Implement Incremental Cache Update in `updateMacroCache`

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Update `updateMacroCache` to load cache and fetch incrementally**

```typescript
/**
 * Loads existing cache from disk.
 */
async function loadCache(): Promise<MacroSnapshot | null> {
  try {
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.safeParse(JSON.parse(rawCache));
    return parsed.success ? parsed.data.data : null;
  } catch {
    return null;
  }
}

/**
 * Fetches all target series incrementally and updates the local JSON cache.
 * @returns Promise<MacroSnapshot>
 */
export async function updateMacroCache(): Promise<MacroSnapshot> {
  const existingCache = await loadCache();
  const snapshot: MacroSnapshot = {
    series: existingCache?.series || {},
    fetchedAt: existingCache?.fetchedAt || {}
  };

  const seriesIds = Object.keys(SERIES_CONFIG);
  
  const promises = seriesIds.map(async (seriesId) => {
    try {
      const config = SERIES_CONFIG[seriesId];
      const existingData = snapshot.series[seriesId] || [];
      
      let newData: DataPoint[] = [];
      if (existingData.length > 0) {
        // Fetch only new data points
        const lastDate = existingData[existingData.length - 1].date;
        newData = await fetchSeries(seriesId, lastDate);
      } else {
        // Full fetch for 15 months history
        newData = await fetchSeries(seriesId, undefined, config.requiredCount);
      }

      // Merge and deduplicate
      const mergedMap = new Map<string, number>();
      existingData.forEach(p => mergedMap.set(p.date, p.value));
      newData.forEach(p => mergedMap.set(p.date, p.value));

      const mergedData = Array.from(mergedMap.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Limit size to maxCount
      snapshot.series[seriesId] = mergedData.slice(-config.maxCount);
      snapshot.fetchedAt[seriesId] = new Date().toISOString();
    } catch (error) {
      console.error(`Failed to fetch ${seriesId} (${TARGET_SERIES[seriesId]}):`, error);
      if (!snapshot.series[seriesId]) {
        snapshot.series[seriesId] = [];
      }
      snapshot.fetchedAt[seriesId] = snapshot.fetchedAt[seriesId] || new Date().toISOString();
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
```

### Task 4: Optimize `getLatestValues` and History Usage

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Update `getLatestValues` to handle larger history**

```typescript
/**
 * Returns the latest single value for each series in the target basket,
 * along with derived trend and spread metrics.
 * @returns Promise<Record<string, number>>
 */
export async function getLatestValues(): Promise<Record<string, number>> {
  let snapshot: MacroSnapshot | null = await loadCache();

  // If no cache or any series has insufficient history (less than 15 months target), update cache
  const needsUpdate = !snapshot || Object.keys(SERIES_CONFIG).some(id => {
    const s = snapshot!.series[id];
    return !s || s.length < SERIES_CONFIG[id].requiredCount;
  });

  if (needsUpdate) {
    console.log('Updating macro cache...');
    snapshot = await updateMacroCache();
  }

  const latest: Record<string, number> = {};
  
  // Basic series
  for (const [series, points] of Object.entries(snapshot!.series)) {
    if (points.length > 0) {
      latest[series] = points[points.length - 1].value;
    }
  }

  // Derived metrics helper
  const getSeriesValue = (id: string, offset: number = 0) => {
    const s = snapshot!.series[id];
    return s && s.length > offset ? s[s.length - 1 - offset].value : null;
  };

  const getSeriesAvg = (id: string, window: number) => {
    const s = snapshot!.series[id];
    if (!s || s.length < window) return null;
    const slice = s.slice(-window);
    return slice.reduce((sum, p) => sum + p.value, 0) / window;
  };

  // oil_price_3m_change: % change in WTI crude over prior 3 months
  // For daily data, 3 months is ~66 trading days
  const oilCurr = getSeriesValue('DCOILWTICO');
  const oilPrior = getSeriesValue('DCOILWTICO', 66); 
  if (oilCurr !== null && oilPrior !== null && oilPrior !== 0) {
    latest['oil_price_3m_change'] = (oilCurr - oilPrior) / oilPrior;
  }

  // nfp_3m_avg: rolling 3-month average of NFP additions (Monthly)
  const nfp = snapshot!.series['PAYEMS'];
  if (nfp && nfp.length >= 4) {
    const changes = [
      nfp[nfp.length - 1].value - nfp[nfp.length - 2].value,
      nfp[nfp.length - 2].value - nfp[nfp.length - 3].value,
      nfp[nfp.length - 3].value - nfp[nfp.length - 4].value,
    ];
    latest['nfp_3m_avg'] = changes.reduce((a, b) => a + b, 0) / 3;
  }

  // real_wages: ECIWAG (quarterly) - CPIAUCSL (monthly)
  // This is a bit tricky due to mixed frequencies. We'll use the latest available for both.
  const wages = getSeriesValue('ECIWAG');
  const cpi = getSeriesValue('CPIAUCSL');
  if (wages !== null && cpi !== null) {
    latest['real_wages'] = wages - cpi;
  }

  // yield_curve_30_2: 30-Year Treasury Yield - 2-Year Treasury Yield (Daily)
  const y30 = getSeriesValue('DGS30');
  const y2 = getSeriesValue('DGS2');
  if (y30 !== null && y2 !== null) {
    latest['yield_curve_30_2'] = y30 - y2;
  }

  // credit_spread_delta: HY OAS current - 6m average
  // For daily data, 6 months is ~132 trading days
  const hySpread = getSeriesValue('BAMLH0A0HYM2');
  const hyAvg6m = getSeriesAvg('BAMLH0A0HYM2', 132);
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
```

### Task 5: Verification

- [ ] **Step 1: Verify compilation**

Run: `pnpm tsc`

- [ ] **Step 2: Run an example to check if it works**

Run: `pnpm ts-node examples/check_fred_v3.ts` (assuming this file exists or creating a similar one)
