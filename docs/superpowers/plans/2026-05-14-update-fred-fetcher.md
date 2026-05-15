# Update fredFetcher.ts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand FRED_SERIES and implement trend computations (3m_avg, etc.) in `getLatestValues()`.

**Architecture:** Update `TARGET_SERIES` constants. Modify `getLatestValues()` to fetch more data points (e.g., last 12 months) to allow rolling calculations. Merge manual indicators into the result.

**Tech Stack:** TypeScript, FRED API, Vitest.

---

### Task 1: Expand TARGET_SERIES

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Update `TARGET_SERIES` with all V3 indicators.**

```typescript
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
  // Rates & Yield Curve
  'FEDFUNDS': 'Effective Federal Funds Rate',
  'DGS2': '2-Year Treasury Yield',
  'DGS10': '10-Year Treasury Yield',
  'DGS30': '30-Year Treasury Yield',
  'T10Y2Y': '10-Year to 2-Year Treasury Spread (Yield Curve)',
  // Dollar & Liquidity
  'DTWEXBGS': 'Trade Weighted U.S. Dollar Index (DXY Proxy)',
  'M2SL': 'M2 Money Supply',
  'GOLDAMGBD228NLBM': 'Gold Fixing Price 10:30 A.M. (London time) in London Bullion Market'
};
```

### Task 2: Implement Trend Computation Logic

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`
- Test: `tests/fredFetcher.test.ts`

- [ ] **Step 1: Update `getLatestValues()` to compute derived metrics.**
Update the function to ensure it has enough history (e.g., fetch 12 months if cache is stale/missing) and calculate:
- `oil_price_3m_change`: % change in WTI crude over prior 3 months. (Wait, I need to add `DCOILWTICO` to `TARGET_SERIES` or fetch it separately).
- `nfp_3m_avg`: rolling 3-month average of NFP additions (diff in `PAYEMS`).
- `real_wages`: `ECIWAG` (wages) - `CPIAUCSL` (inflation).
- `yield_curve_30_2`: `DGS30` - `DGS2`.
- `credit_spread_delta`: `BAMLH0A0HYM2` (current) - 6m average of `BAMLH0A0HYM2`.

**Correction:** `PAYEMS` is total payrolls, NFP additions is monthly change. `nfp_3m_avg` should be avg of monthly changes.

- [ ] **Step 2: Add `DCOILWTICO` to `TARGET_SERIES`.**

- [ ] **Step 3: Update `getLatestValues()` implementation.**

```typescript
export async function getLatestValues(): Promise<Record<string, number>> {
  let snapshot: MacroSnapshot;
  try {
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.safeParse(JSON.parse(rawCache));
    // We need at least 7 points for 6m average + current
    if (!parsed.success || Object.values(parsed.data.data.series).some(s => s.length < 7)) {
      snapshot = await updateMacroCache(12);
    } else {
      snapshot = parsed.data.data;
    }
  } catch (e) {
    snapshot = await updateMacroCache(12);
  }

  const latest: Record<string, number> = {};
  
  // Basic series
  for (const [series, points] of Object.entries(snapshot.series)) {
    if (points.length > 0) {
      latest[series] = points[points.length - 1].value;
    }
  }

  // Derived metrics
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

  // oil_price_3m_change
  const oilCurr = getSeriesValue('DCOILWTICO');
  const oilPrior = getSeriesValue('DCOILWTICO', 3);
  if (oilCurr !== null && oilPrior !== null && oilPrior !== 0) {
    latest['oil_price_3m_change'] = (oilCurr - oilPrior) / oilPrior;
  }

  // nfp_3m_avg
  const nfp = snapshot.series['PAYEMS'];
  if (nfp && nfp.length >= 4) {
    const changes = [
      nfp[nfp.length - 1].value - nfp[nfp.length - 2].value,
      nfp[nfp.length - 2].value - nfp[nfp.length - 3].value,
      nfp[nfp.length - 3].value - nfp[nfp.length - 4].value,
    ];
    latest['nfp_3m_avg'] = changes.reduce((a, b) => a + b, 0) / 3;
  }

  // real_wages (ECIWAG is often quarterly, this might need interpolation or just latest)
  const wages = getSeriesValue('ECIWAG');
  const cpi = getSeriesValue('CPIAUCSL');
  if (wages !== null && cpi !== null) {
    latest['real_wages'] = wages - cpi;
  }

  // yield_curve_30_2
  const y30 = getSeriesValue('DGS30');
  const y2 = getSeriesValue('DGS2');
  if (y30 !== null && y2 !== null) {
    latest['yield_curve_30_2'] = y30 - y2;
  }

  // credit_spread_delta (HY OAS current - 6m avg)
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
```

- [ ] **Step 4: Update tests in `tests/fredFetcher.test.ts` to verify derived metrics.**

### Task 3: Final Verification

- [ ] **Step 1: Run all tests.**

Run: `pnpm test tests/fredFetcher.test.ts`
Expected: PASS

- [ ] **Step 2: Run a manual check script if possible.**
Create a small script `examples/check_fred_v3.ts` to print all latest values.

```typescript
import 'dotenv/config';
import { getLatestValues } from './src/data/fetchers/fredFetcher.js';

const latest = await getLatestValues();
console.log(JSON.stringify(latest, null, 2));
```

Run: `node --loader ts-node/esm examples/check_fred_v3.ts`
(Note: needs ts-node or just use a temporary test)
