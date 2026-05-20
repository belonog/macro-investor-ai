# Indicator Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `RawIndicatorSchema` and `ManualIndicatorSchema` with a `description` field and update fetchers and tests.

**Architecture:** Update central types, then update fetchers (FRED, Polygon), then update manual indicators utility, then update all tests to match the new schema.

**Tech Stack:** TypeScript, Zod, Vitest.

---

### Task 1: Update Central Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update RawIndicatorSchema and ManualIndicatorSchema**

```typescript
export const RawIndicatorSchema = z.object({
  value: z.number(),
  unit: z.string(),
  description: z.string(), // Added
  as_of: z.string(),
  source: z.string(),
});

export const ManualIndicatorSchema = z.object({
  value: z.number(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  description: z.string(), // Added
  updated_at: z.string().datetime(),
  source: z.string(),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add description field to indicator schemas"
```

---

### Task 2: Update FRED Fetcher

**Files:**
- Modify: `src/data/fetchers/fredFetcher.ts`

- [ ] **Step 1: Update wrap helper and derived metrics**

Update `wrap` to include `description`. Assign explicit descriptions to derived metrics and pull from `TARGET_SERIES` for raw ones.

- [ ] **Step 2: Commit**

```bash
git add src/data/fetchers/fredFetcher.ts
git commit -m "feat: populate descriptions in fredFetcher"
```

---

### Task 3: Update Polygon Fetcher

**Files:**
- Modify: `src/data/fetchers/polygonFetcher.ts`

- [ ] **Step 1: Update getGoldSpotPrice**

Add `description: "Gold Spot Price (XAU/USD)"` to the returned object.

- [ ] **Step 2: Commit**

```bash
git add src/data/fetchers/polygonFetcher.ts
git commit -m "feat: add description to gold spot price in polygonFetcher"
```

---

### Task 4: Update Manual Indicators Utility

**Files:**
- Modify: `src/utils/manualIndicators.ts`

- [ ] **Step 1: Update setManualIndicator or any internal logic if needed**

The utility already uses the schema, but ensure any default values or logic respect the new mandatory field.

- [ ] **Step 2: Commit**

```bash
git add src/utils/manualIndicators.ts
git commit -m "feat: update manual indicators utility for descriptions"
```

---

### Task 5: Update Tests

**Files:**
- Modify: `tests/types.test.ts`
- Modify: `tests/fredFetcher.test.ts`
- Modify: `tests/polygonFetcher.test.ts`
- Modify: `tests/manualIndicators.test.ts`

- [ ] **Step 1: Update mock data in all relevant tests**

Add `description` field to all test data objects.

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: 100% PASS

- [ ] **Step 3: Run lint and type check**

Run: `pnpm run lint && tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: update tests for indicator descriptions"
```
