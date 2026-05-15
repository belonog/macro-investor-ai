# Consolidate Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize all types and Zod schemas into `src/types/index.ts`, updating them to align with Spec v3 (snake_case for AI-facing fields).

**Architecture:** Move all definitions from `src/data/types.ts` to `src/types/index.ts`. Rename fields in `RegimeSnapshot` (now `RegimeAssessment`) and `RebalancingReport` (now `RebalancingOutput`) to use snake_case as required by Spec v3. Update `PositionConfigSchema` to include optional `targets` and `notes`.

**Tech Stack:** TypeScript, Zod, Vitest.

---

### Task 1: Create consolidated types file

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create `src/types/index.ts` with updated schemas**

```typescript
import { z } from 'zod';

export const PositionSnapshotSchema = z.object({
  symbol: z.string(),
  quantity: z.number(),
  avgCost: z.number(),
  marketPrice: z.number(),
  marketValue: z.number(),
  unrealizedPnl: z.number(),
  unrealizedPnlPct: z.number(),
  fetchedAt: z.string().datetime(),
});

export type PositionSnapshot = z.infer<typeof PositionSnapshotSchema>;

export const AlertSchema = z.object({
  level: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  symbol: z.string().optional(),
  message: z.string(),
  action: z.string().optional(),
});

export type Alert = z.infer<typeof AlertSchema>;

export const DataPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  value: z.number(),
});

export type DataPoint = z.infer<typeof DataPointSchema>;

export const MacroSnapshotSchema = z.object({
  series: z.record(z.string(), z.array(DataPointSchema)),
  fetchedAt: z.record(z.string(), z.string().datetime()),
});
export type MacroSnapshot = z.infer<typeof MacroSnapshotSchema>;

export const MacroCacheSchema = z.object({
  fetchedAt: z.string().datetime(),
  data: MacroSnapshotSchema,
});
export type MacroCache = z.infer<typeof MacroCacheSchema>;

export const RegimeQuadrantSchema = z.enum([
  'Goldilocks',
  'Inflationary Boom',
  'Stagflation',
  'Deflationary Recession',
]);
export type RegimeQuadrant = z.infer<typeof RegimeQuadrantSchema>;

export const RegimeDriftSchema = z.enum(['Stable', 'Weakening', 'Transitioning', 'Shifted']);
export type RegimeDrift = z.infer<typeof RegimeDriftSchema>;

export const RegimeAssessmentSchema = z.object({
  regime_quadrant: RegimeQuadrantSchema,
  confidence: z.number().min(0).max(100),
  inflation_score: z.number().min(0).max(1),
  growth_score: z.number().min(0).max(1),
  regime_drift_vs_prior: RegimeDriftSchema,
  transition_signal: z.string().optional(),
  key_drivers: z.array(z.string()),
  confirming_indicators: z.array(z.string()),
  contradicting_indicators: z.array(z.string()),
  central_thesis_conflict: z.string(),
  fastest_path_to_being_wrong: z.string(),
  watch_next: z.array(z.string()),
  assessed_at: z.string().datetime(),
});
export type RegimeAssessment = z.infer<typeof RegimeAssessmentSchema>;

// Alias for backward compatibility during migration if needed, but we aim to replace it.
export type RegimeSnapshot = RegimeAssessment;
export const RegimeSnapshotSchema = RegimeAssessmentSchema;

export const PositionTypeSchema = z.enum(['macro_core', 'macro_hedge', 'speculative', 'equity_single']);
export type PositionType = z.infer<typeof PositionTypeSchema>;

export const RebalancingActionSchema = z.enum(['Hold', 'Add', 'Trim', 'Exit', 'Watch']);
export type RebalancingAction = z.infer<typeof RebalancingActionSchema>;

export const PositionAssessmentSchema = z.object({
  symbol: z.string(),
  position_type: PositionTypeSchema,
  regime_fit: z.enum(['Strong', 'Moderate', 'Weak', 'Misaligned']),
  thesis_intact: z.boolean(),
  suggested_action: RebalancingActionSchema,
  action_rationale: z.string(),
  urgency: z.enum(['None', 'This Week', 'Immediate']),
  conflict_flag: z.string().nullable(),
});

export const RebalancingOutputSchema = z.object({
  regime_portfolio_alignment_score: z.number().min(0).max(1),
  alignment_grade: z.enum(['A', 'B', 'C', 'D']),
  position_assessments: z.array(PositionAssessmentSchema),
  priority_actions: z.array(z.string()),
  regime_transition_implication: z.string(),
  thesis_conflict_resolution: z.string(),
  rebalancing_rationale: z.string(),
  fastest_path_to_being_wrong: z.string(),
  evaluated_at: z.string().datetime(),
});
export type RebalancingOutput = z.infer<typeof RebalancingOutputSchema>;

// Alias for backward compatibility
export type RebalancingReport = RebalancingOutput;
export const RebalancingReportSchema = RebalancingOutputSchema;

export const PositionConfigSchema = z.object({
  shares: z.number(),
  avg_cost: z.number(),
  position_type: PositionTypeSchema,
  thesis: z.string(),
  regime_match: z.array(RegimeQuadrantSchema),
  stop: z.number().optional(),
  hard_stop: z.number().optional(),
  targets: z.array(z.number()).optional(),
  deadline: z.string().optional(), // YYYY-MM-DD
  thesis_invalidation: z.string(),
  notes: z.string().optional(),
  threshold_monitor: z.object({
    indicator: z.enum(['yield_30y', 'breakeven_5y5y', 'yield_10y', 'fed_funds']),
    warn_at: z.number(),
    hard_exit_at: z.number(),
  }).optional(),
});
export type PositionConfig = z.infer<typeof PositionConfigSchema>;

export const PortfolioConfigSchema = z.record(z.string(), PositionConfigSchema);
export type PortfolioConfig = z.infer<typeof PortfolioConfigSchema>;
```

### Task 2: Update existing tests

**Files:**
- Modify: `tests/types.test.ts`

- [ ] **Step 1: Update `tests/types.test.ts` to use new schemas and field names**

```typescript
import { describe, it, expect } from 'vitest';
import { 
  PositionSnapshotSchema, 
  AlertSchema, 
  DataPointSchema, 
  MacroSnapshotSchema, 
  MacroCacheSchema, 
  RegimeQuadrantSchema, 
  RegimeAssessmentSchema 
} from '../src/types';

describe('PositionSnapshotSchema', () => {
  it('should validate a correct position snapshot', () => {
    const validPosition = {
      symbol: 'AAPL',
      quantity: 10,
      avgCost: 150,
      marketPrice: 175,
      marketValue: 1750,
      unrealizedPnl: 250,
      unrealizedPnlPct: 16.67,
      fetchedAt: new Date().toISOString(),
    };
    expect(PositionSnapshotSchema.safeParse(validPosition).success).toBe(true);
  });
});

describe('MacroSnapshotSchema', () => {
  it('should validate a correct macro snapshot', () => {
    const validSnapshot = {
      series: {
        'CPI': [{ date: '2024-01-01', value: 3.1 }],
        'GDP': [{ date: '2023-12-31', value: 2.5 }],
      },
      fetchedAt: {
        'CPI': new Date().toISOString(),
        'GDP': new Date().toISOString(),
      }
    };
    expect(MacroSnapshotSchema.safeParse(validSnapshot).success).toBe(true);
  });
});

describe('RegimeAssessmentSchema', () => {
  it('should validate a correct regime assessment', () => {
    const validAssessment = {
      regime_quadrant: 'Goldilocks',
      confidence: 85,
      inflation_score: 0.3,
      growth_score: 0.7,
      regime_drift_vs_prior: 'Stable',
      key_drivers: ['Low inflation', 'Moderate growth'],
      confirming_indicators: ['CPI stable'],
      contradicting_indicators: ['PPI rising'],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'Growth slowing faster than expected',
      watch_next: ['NFP'],
      transition_signal: 'Possible uptick in CPI',
      assessed_at: new Date().toISOString()
    };
    expect(RegimeAssessmentSchema.safeParse(validAssessment).success).toBe(true);
  });
});

describe('PositionConfigSchema', () => {
  it('should validate with optional fields', () => {
    const config = {
      shares: 100,
      avg_cost: 50,
      position_type: 'macro_core',
      thesis: 'Long term growth',
      regime_match: ['Goldilocks'],
      thesis_invalidation: 'Growth slows',
      targets: [100, 150],
      notes: 'Some notes'
    };
    expect(PositionConfigSchema.safeParse(config).success).toBe(true);
  });

  it('should validate without optional fields', () => {
    const minimalConfig = {
      shares: 100,
      avg_cost: 50,
      position_type: 'macro_core',
      thesis: 'Long term growth',
      regime_match: ['Goldilocks'],
      thesis_invalidation: 'Growth slows'
    };
    expect(PositionConfigSchema.safeParse(minimalConfig).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test tests/types.test.ts`

### Task 3: Update imports in the codebase

**Files:**
- Modify: `src/agents/db.ts`
- Modify: `src/agents/rebalancingAgent.ts`
- Modify: `src/agents/regimeAgent.ts`
- Modify: `src/monitor/eodMonitor.ts`
- Modify: `src/data/fetchers/fredFetcher.ts`
- Modify: `src/data/fetchers/ibkrFetcher.ts`

- [ ] **Step 1: Update imports and usage in `src/agents/regimeAgent.ts`**
Rename `quadrant` to `regime_quadrant`, `keyDrivers` to `key_drivers`, `evaluatedAt` to `assessed_at` in the agent's logic if applicable.

- [ ] **Step 2: Update imports and usage in `src/agents/rebalancingAgent.ts`**
Update to use `RebalancingOutput` and its new fields.

- [ ] **Step 3: Update imports in other files**
Update `../data/types` to `../types`.

### Task 4: Cleanup

- [ ] **Step 1: Remove `src/data/types.ts`**
- [ ] **Step 2: Run all tests to ensure no regressions**

Run: `pnpm test`
