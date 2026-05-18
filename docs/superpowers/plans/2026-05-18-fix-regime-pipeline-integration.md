# Fix Quantamental Regime Pipeline Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix indicator key mismatches, unit inconsistencies, and database population issues in the Regime Pipeline.

**Architecture:** Update `fredFetcher` to map FRED IDs to pipeline-compatible keys and units. Update `dbManager` and `regimeAgent` to ensure all scoring fields are persisted.

**Tech Stack:** TypeScript, Node.js, SQLite (better-sqlite3).

---

### Task 1: Update Database Logging Types and Implementation

**Files:**
- Modify: `src/agents/db.ts`
- Modify: `src/agents/regimeAgent.ts`

- [ ] **Step 1: Update `RegimeEvaluationRecord` in `src/agents/db.ts`**

Include the scoring and drift fields.

```typescript
export interface RegimeEvaluationRecord {
  timestamp: string;
  quadrant: RegimeQuadrant;
  confidence: number;
  inflation_score: number;
  growth_score: number;
  regime_drift_vs_prior: string;
  data_inputs: Record<string, any>;
  raw_response: Record<string, any>;
}
```

- [ ] **Step 2: Update `logRegimeEvaluation` in `src/agents/db.ts`**

Pass the new fields to `newDb.insertRegimeHistory`.

```typescript
  public logRegimeEvaluation(evaluation: RegimeEvaluationRecord) {
    try {
      newDb.insertRegimeHistory({
        regime_quadrant: evaluation.quadrant,
        confidence: evaluation.confidence,
        inflation_score: evaluation.inflation_score,
        growth_score: evaluation.growth_score,
        regime_drift_vs_prior: evaluation.regime_drift_vs_prior,
        assessed_at: evaluation.timestamp,
        data_inputs: evaluation.data_inputs,
        raw_response: evaluation.raw_response
      });
      // ... rest of the function
```

- [ ] **Step 3: Update `runRegimeAgent` call to `logRegimeEvaluation` in `src/agents/regimeAgent.ts`**

Pass the new fields from `finalAssessment`.

```typescript
    // 8. Persist and Cache
    dbManager.logRegimeEvaluation({
      timestamp: finalAssessment.assessedAt,
      quadrant: finalAssessment.regimeQuadrant,
      confidence: finalAssessment.finalConfidence,
      inflation_score: finalAssessment.inflationScore,
      growth_score: finalAssessment.growthScore,
      regime_drift_vs_prior: finalAssessment.regimeDriftVsPrior,
      data_inputs: macroData,
      raw_response: finalAssessment,
    });
```

- [ ] **Step 4: Commit**

```bash
git add src/agents/db.ts src/agents/regimeAgent.ts
git commit -m "fix: ensure regime scoring fields are persisted to database"
```

### Task 2: Refactor `fredFetcher` for Pipeline Compatibility

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Update `getLatestValues` to include mapping and unit conversions**

Implement the mapping from FRED IDs and derived metrics to the keys expected by `regime_pipeline.json`. Convert growth rates to percentages (* 100).

```typescript
export async function getLatestValues(): Promise<Record<string, number>> {
  // ... (keep cache loading logic)

  const latest: Record<string, number> = {};
  
  // Derived metrics helper
  const getSeriesValue = (id: string, offset: number = 0) => {
    const s = snapshot.series[id];
    return s && s.length > offset ? s[s.length - 1 - offset].value : null;
  };

  const calculateYoY = (id: string) => {
    const curr = getSeriesValue(id);
    const prior = getSeriesValue(id, 12); // Assuming monthly
    if (curr !== null && prior !== null && prior !== 0) {
      return ((curr - prior) / prior) * 100;
    }
    return null;
  };

  // Inflation Metrics
  const cpiYoY = calculateYoY('CPIAUCSL');
  if (cpiYoY !== null) latest['cpi_yoy_pct'] = cpiYoY;
  
  const pceYoY = calculateYoY('PCEPI');
  if (pceYoY !== null) latest['pce_yoy_pct'] = pceYoY;
  
  const ppiYoY = calculateYoY('PPIACO');
  if (ppiYoY !== null) latest['ppi_yoy_pct'] = ppiYoY;

  const be5y = getSeriesValue('T5YIE');
  if (be5y !== null) latest['breakeven_5y_pct'] = be5y;

  const oilCurr = getSeriesValue('DCOILWTICO');
  const oilPrior = getSeriesValue('DCOILWTICO', 3); // 3 months
  if (oilCurr !== null && oilPrior !== null && oilPrior !== 0) {
    latest['oil_price_3m_change_pct'] = ((oilCurr - oilPrior) / oilPrior) * 100;
  }

  // Growth Metrics
  const gdpCurr = getSeriesValue('GDPC1');
  const gdpPrior = getSeriesValue('GDPC1', 1); // Quarterly
  if (gdpCurr !== null && gdpPrior !== null && gdpPrior !== 0) {
    const qoq = (gdpCurr - gdpPrior) / gdpPrior;
    latest['real_gdp_qoq_ann_pct'] = (Math.pow(1 + qoq, 4) - 1) * 100;
  }

  const nfp = snapshot.series['PAYEMS'];
  if (nfp && nfp.length >= 4) {
    const changes = [
      nfp[nfp.length - 1].value - nfp[nfp.length - 2].value,
      nfp[nfp.length - 2].value - nfp[nfp.length - 3].value,
      nfp[nfp.length - 3].value - nfp[nfp.length - 4].value,
    ];
    latest['nfp_3m_avg_k'] = changes.reduce((a, b) => a + b, 0) / 3;
  }

  const rsNominalYoY = calculateYoY('RSAFS');
  if (rsNominalYoY !== null && cpiYoY !== null) {
    latest['retail_sales_yoy_real_pct'] = rsNominalYoY - cpiYoY;
  }

  // Keep other raw series for general info
  for (const [series, points] of Object.entries(snapshot.series)) {
    if (points.length > 0) {
      latest[series] = points[points.length - 1].value;
    }
  }

  // Merge manual indicators
  const manual = getManualIndicators();
  for (const [key, indicator] of Object.entries(manual)) {
    latest[key] = indicator.value;
  }

  return latest;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/fetchers/fredFetcher.ts
git commit -m "refactor: map FRED indicators to pipeline keys and convert to percentages"
```

### Task 3: Final Verification

**Files:**
- N/A (run scripts)

- [ ] **Step 1: Run `examples/run_regime_check.ts`**

Run: `pnpm tsx examples/run_regime_check.ts`
Expected: Successfully runs the pipeline, shows correct indicator keys (e.g. `cpi_yoy_pct`), and logs to database.

- [ ] **Step 2: Verify Database**

Check `logs/regime_history.db` to ensure `inflation_score` and `growth_score` are no longer NULL.

Run: `sqlite3 logs/regime_history.db "SELECT quadrant, confidence, inflation_score, growth_score FROM regime_history ORDER BY assessed_at DESC LIMIT 1;"`

- [ ] **Step 3: Commit all changes**

```bash
git status
# Ensure everything is clean
```

---
