# Regime Agent Prompt Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pre-calculation of macro indicators to improve `regimeAgent` decision making, as recommended by the expert review.

**Architecture:** Extend `src/data/fetchers/fredFetcher.ts` to calculate YoY, QoQ, and MoM changes for key indicators. Update `evaluateRegime` in `src/agents/regimeAgent.ts` to pass these derived metrics to the system prompt.

**Tech Stack:** TypeScript, Node.js, FRED API, Zod.

---

### Task 1: Update FRED Data Pipeline with Derived Metrics

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Implement YoY/QoQ/MoM helper functions**
  Create utility functions in `fredFetcher.ts` to calculate growth rates from series.

```typescript
// Add these helpers
function calculateGrowth(current: number, past: number): number {
  return (current - past) / past;
}

// Add specifically for annualized rates if needed
```

- [ ] **Step 2: Update `getLatestValues` to include YoY/QoQ for key indicators**
  Extend `getLatestValues` to calculate:
  - `cpi_yoy` (12 months ago)
  - `pce_yoy`
  - `real_gdp_qoq` (need to look at quarterly data, or interpolate)
  - `ism_manufacturing` (Requires adding to `TARGET_SERIES` if possible, or mapping manually via `manualIndicators`)

- [ ] **Step 3: Commit**
```bash
git add src/data/fetchers/fredFetcher.ts
git commit -m "feat: pre-calculate macro growth metrics in fredFetcher"
```

### Task 2: Refactor `evaluateRegime` to pass new payload

**Files:**
- Modify: `src/agents/regimeAgent.ts`

- [ ] **Step 1: Update `evaluateRegime` payload construction**
  Pass the derived indicators alongside raw values.

- [ ] **Step 2: Update documentation or types if necessary (check `src/types/index.ts`)**

- [ ] **Step 3: Commit**
```bash
git add src/agents/regimeAgent.ts
git commit -m "refactor: update regimeAgent evaluation payload with derived metrics"
```
---
