# Logging Migration Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the migration of internal `console` calls to the structured `logger` (pino).

**Architecture:** Use the existing `logger` instance from `src/utils/logger.ts`. Replace `console.log/warn/error` with `logger.info/warn/error` in internal application files, ensuring proper error object passing to pino.

**Tech Stack:** TypeScript, Pino, Vitest.

---

### Task 1: Migrate Regime Agent

**Files:**
- Modify: `src/agents/regimeAgent.ts`

- [ ] **Step 1: Replace console.warn with logger.warn**

```typescript
// Old
console.warn(`Failed to parse positions config at ${POSITIONS_CONFIG_PATH}:`, err);
// New
logger.warn(err, `Failed to parse positions config at ${POSITIONS_CONFIG_PATH}`);
```

- [ ] **Step 2: Verify with lint and tests**

Run: `pnpm run lint && pnpm test tests/regimeAgent.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/agents/regimeAgent.ts
git commit -m "chore: migrate regimeAgent to structured logger"
```

---

### Task 2: Migrate FRED Fetcher

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Replace console.warn with logger.warn**

```typescript
// Old
console.warn('Invalid macro cache. Re-fetching...');
// New
logger.warn('Invalid macro cache. Re-fetching...');
```

- [ ] **Step 2: Verify with lint and tests**

Run: `pnpm run lint && pnpm test tests/fredFetcher.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/data/fetchers/fredFetcher.ts
git commit -m "chore: migrate fredFetcher to structured logger"
```

---

### Task 3: Migrate Indicator Derivation

**Files:**
- Modify: `src/data/indicators/derivation.ts`

- [ ] **Step 1: Import logger**

```typescript
import { logger } from '../../utils/logger.js';
```

- [ ] **Step 2: Replace console.warn with logger.warn**

```typescript
// Old
console.warn(`No indicator registry entry for key: ${key}`);
// New
logger.warn(`No indicator registry entry for key: ${key}`);
```

- [ ] **Step 3: Verify with lint and tests**

Run: `pnpm run lint && pnpm test tests/utils.test.ts` (or relevant test for derivation)
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/data/indicators/derivation.ts
git commit -m "chore: migrate derivation to structured logger"
```

---

### Task 4: Migrate Flows (Daily Digest & Event Prebrief)

**Files:**
- Modify: `src/flows/dailyDigest.ts`
- Modify: `src/flows/eventPrebrief.ts`

- [ ] **Step 1: Migrate dailyDigest.ts**

```typescript
// Old
console.warn('Failed to parse positions.json for daily digest:', err);
// New
logger.warn(err, 'Failed to parse positions.json for daily digest');
```

- [ ] **Step 2: Migrate eventPrebrief.ts**

```typescript
// Old
console.warn('Positions config not found. Skipping event pre-brief.');
// New
logger.warn('Positions config not found. Skipping event pre-brief.');
```

- [ ] **Step 3: Verify with lint and tests**

Run: `pnpm run lint && pnpm test tests/dailyDigest.test.ts tests/eventPrebrief.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/flows/dailyDigest.ts src/flows/eventPrebrief.ts
git commit -m "chore: migrate flows to structured logger"
```

---

### Task 5: Migrate Manual Indicators Utility

**Files:**
- Modify: `src/utils/manualIndicators.ts`

- [ ] **Step 1: Import logger**

```typescript
import { logger } from '../utils/logger.js';
```

- [ ] **Step 2: Replace console.error with logger.error**

```typescript
// Old
console.error('Error reading manual indicators:', error);
// New
logger.error(error, 'Error reading manual indicators');
```

- [ ] **Step 3: Verify with lint and tests**

Run: `pnpm run lint && pnpm test tests/manualIndicators.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/manualIndicators.ts
git commit -m "chore: migrate manualIndicators to structured logger"
```

---

### Task 6: Migrate Rebalancing Agent Legacy CLI

**Files:**
- Modify: `src/agents/rebalancingAgent.ts`

- [ ] **Step 1: Replace console calls in CLI block with logger**

```typescript
// CLI entry point
if (import.meta.url.endsWith(process.argv[1])) {
  generateRebalancingReport()
    .then(report => {
      logger.info('Rebalancing Report Generated Successfully');
      logger.info({ report_grade: report.alignment_grade, score: report.alignment_score }, 'Rebalancing Grade');
      logger.info({ priority_actions: report.priority_actions }, 'Priority Actions');
    })
    .catch(err => {
      logger.error(err, 'Failed to generate report');
      process.exit(1);
    });
}
```

- [ ] **Step 2: Verify with lint and tests**

Run: `pnpm run lint && pnpm test tests/rebalancingAgent.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/agents/rebalancingAgent.ts
git commit -m "chore: migrate rebalancingAgent legacy CLI to structured logger"
```
