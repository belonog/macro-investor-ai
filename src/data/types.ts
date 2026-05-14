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

export const MacroSnapshotSchema = z.record(z.string(), z.array(DataPointSchema));
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

export const RegimeSnapshotSchema = z.object({
  quadrant: RegimeQuadrantSchema,
  confidence: z.number().min(0).max(100),
  inflation_score: z.number().min(0).max(1),
  growth_score: z.number().min(0).max(1),
  regime_drift_vs_prior: RegimeDriftSchema,
  transition_signal: z.string().optional(),
  keyDrivers: z.array(z.string()),
  confirming_indicators: z.array(z.string()),
  contradicting_indicators: z.array(z.string()),
  central_thesis_conflict: z.string(),
  fastest_path_to_being_wrong: z.string(),
  watch_next: z.array(z.string()),
  evaluatedAt: z.string().datetime(),
});
export type RegimeSnapshot = z.infer<typeof RegimeSnapshotSchema>;

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

export const RebalancingReportSchema = z.object({
  alignment_score: z.number().min(0).max(1),
  alignment_grade: z.enum(['A', 'B', 'C', 'D']),
  position_assessments: z.array(PositionAssessmentSchema),
  priority_actions: z.array(z.string()),
  regime_transition_implication: z.string(),
  thesis_conflict_resolution: z.string(),
  rebalancing_rationale: z.string(),
  fastest_path_to_being_wrong: z.string(),
  evaluatedAt: z.string().datetime(),
});
export type RebalancingReport = z.infer<typeof RebalancingReportSchema>;

export const PositionConfigSchema = z.object({
  shares: z.number(),
  avg_cost: z.number(),
  position_type: PositionTypeSchema,
  thesis: z.string(),
  regime_match: z.array(RegimeQuadrantSchema),
  stop: z.number().optional(),
  hard_stop: z.number().optional(),
  deadline: z.string().optional(), // YYYY-MM-DD
  thesis_invalidation: z.string(),
  threshold_monitor: z.object({
    indicator: z.enum(['yield_30y', 'breakeven_5y5y', 'yield_10y', 'fed_funds']),
    warn_at: z.number(),
    hard_exit_at: z.number(),
  }).optional(),
});
export type PositionConfig = z.infer<typeof PositionConfigSchema>;

export const PortfolioConfigSchema = z.record(z.string(), PositionConfigSchema);
export type PortfolioConfig = z.infer<typeof PortfolioConfigSchema>;
