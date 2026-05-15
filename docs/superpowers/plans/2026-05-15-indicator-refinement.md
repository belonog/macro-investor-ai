# Indicator Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the macroeconomic indicator set by shifting commodity spot prices to FRED, focusing EIA on supply fundamentals (inventories and production), and adding key labor metrics to BLS.

**Architecture:** We will update the three primary fetchers (`fredFetcher.ts`, `eiaFetcher.ts`, `blsFetcher.ts`) and their respective test suites. Finally, we will update `config/regime_weights.json` to incorporate the new data points into the regime scoring model.

**Tech Stack:** Node.js, TypeScript, Axios, Vitest, Zod.

---

### Task 1: Update FRED Fetcher

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`
- Modify: `tests/fredFetcher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/fredFetcher.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { FRED_SERIES } from '../src/data/fetchers/fredFetcher.js';

describe('fredFetcher FRED_SERIES', () => {
  it('contains WTI Crude and Henry Hub Natural Gas series IDs', () => {
    expect(FRED_SERIES).toHaveProperty('wti_crude', 'DCOILWTICO');
    expect(FRED_SERIES).toHaveProperty('henry_hub_ng', 'DHHNGSP');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fredFetcher.test.ts`
Expected: FAIL due to missing `wti_crude` and `henry_hub_ng` properties.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/data/fetchers/fredFetcher.ts
// Add to FRED_SERIES object:
export const FRED_SERIES: Record<string, string> = {
  // ... existing series
  wti_crude:         'DCOILWTICO',
  henry_hub_ng:      'DHHNGSP',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fredFetcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/fetchers/fredFetcher.ts tests/fredFetcher.test.ts
git commit -m "feat: add WTI crude and Henry Hub NG to FRED series"
```

---

### Task 2: Update EIA Fetcher

**Files:**
- Modify: `src/data/fetchers/eiaFetcher.ts`
- Modify: `tests/eiaFetcher.test.ts`
- Modify: `src/flows/regimeCycle.ts` (if needed for interface changes)

- [ ] **Step 1: Update the failing test**

```typescript
// tests/eiaFetcher.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getCrudeInventoryChange, getCrudeProduction, getLatest } from '../src/data/fetchers/eiaFetcher.js';

vi.mock('axios');

describe('eiaFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches crude inventory change', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { response: { data: [{ value: -1500 }] } }
    });
    const change = await getCrudeInventoryChange();
    expect(change).toBe(-1500);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('api.eia.gov'), expect.any(Object));
  });

  it('fetches crude production', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { response: { data: [{ value: 13200 }] } }
    });
    const prod = await getCrudeProduction();
    expect(prod).toBe(13200);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('api.eia.gov'), expect.any(Object));
  });

  it('gets all latest values', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { response: { data: [{ value: 10 }] } }
    });
    const latest = await getLatest();
    expect(latest).toHaveProperty('crude_inventory_change');
    expect(latest).toHaveProperty('crude_production');
    expect(latest).not.toHaveProperty('crude_oil_price'); // Ensure spot prices are removed
    expect(latest).not.toHaveProperty('nat_gas_price');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/eiaFetcher.test.ts`
Expected: FAIL due to missing `getCrudeProduction` and incorrect `getLatest` object signature.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/data/fetchers/eiaFetcher.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/eiaFetcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/fetchers/eiaFetcher.ts tests/eiaFetcher.test.ts
git commit -m "refactor: refocus EIA fetcher on supply fundamentals"
```

---

### Task 3: Update BLS Fetcher

**Files:**
- Modify: `src/data/fetchers/blsFetcher.ts`
- Modify: `tests/blsFetcher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/blsFetcher.test.ts
// Add this assertion to the existing getLatestReleases test
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getLatestReleases } from '../src/data/fetchers/blsFetcher.js';

// Inside describe('getLatestReleases')
it('includes new labor metrics in the request payload', async () => {
  const mockPost = vi.mocked(axios.post).mockResolvedValueOnce({
    data: {
      status: 'REQUEST_SUCCEEDED',
      Results: { series: [] }
    }
  });

  await getLatestReleases();

  expect(mockPost).toHaveBeenCalledWith(
    expect.stringContaining('api.bls.gov'),
    expect.objectContaining({
      seriesid: expect.arrayContaining([
        'CES0000000001', 
        'CUUR0000SA0', 
        'WPSFD4', 
        'LNS14000000', // Unemployment Rate
        'CES0500000003', // Avg Hourly Earnings
        'JTU000000000000000JOL' // JOLTS
      ])
    })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/blsFetcher.test.ts`
Expected: FAIL because the new series IDs are missing from the `seriesid` array in the request.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/data/fetchers/blsFetcher.ts
// Update the BLS_SERIES object inside getLatestReleases:
export async function getLatestReleases(): Promise<any[]> {
  const currentYear = new Date().getFullYear().toString();
  const BLS_SERIES = {
    nfp_total: 'CES0000000001',
    cpi_all_urban: 'CUUR0000SA0',
    ppi_final_demand: 'WPSFD4',
    unemployment_rate: 'LNS14000000',
    avg_hourly_earnings: 'CES0500000003',
    jolts_job_openings: 'JTU000000000000000JOL',
  };
  // ... rest remains exactly the same
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/blsFetcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/fetchers/blsFetcher.ts tests/blsFetcher.test.ts
git commit -m "feat: add unemployment, hourly earnings, and JOLTS to BLS fetcher"
```

---

### Task 4: Update Regime Weights Configuration

**Files:**
- Modify: `config/regime_weights.json`

- [ ] **Step 1: Update the configuration file**

```json
{
  "inflation_indicators": {
    "cpi_yoy": 0.20,
    "pce_yoy": 0.20,
    "breakeven_5y5y": 0.15,
    "ppi_yoy": 0.10,
    "avg_hourly_earnings": 0.15,
    "wti_crude_3m_change": 0.10,
    "fertilizer_index_3m_change": 0.10
  },
  "growth_indicators": {
    "ism_manufacturing": 0.20,
    "ism_services": 0.15,
    "real_gdp_qoq": 0.15,
    "unemployment_rate": 0.20,
    "nfp_3m_avg": 0.10,
    "jolts_job_openings": 0.10,
    "crude_inventory_change": 0.05,
    "crude_production": 0.05
  },
  "regime_thresholds": {
    "inflation_high": 0.60,
    "inflation_low": 0.40,
    "growth_high": 0.55,
    "growth_low": 0.45
  },
  "transition_sensitivity": 0.10,
  "notes": {
    "unemployment_rate": "Inverted for growth scoring — rising unemployment = lower growth score",
    "wti_crude_3m_change": "Calculated via FRED DCOILWTICO",
    "crude_inventory_change": "Inverted for growth scoring — rising inventory = lower demand/growth score"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add config/regime_weights.json
git commit -m "chore: integrate new BLS labor and EIA fundamental indicators into regime weights"
```