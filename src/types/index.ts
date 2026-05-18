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
  symbol: z.string().nullable(),
  message: z.string(),
  action: z.string().nullable(),
  createdAt: z.string(),
});

export type Alert = z.infer<typeof AlertSchema>;
export type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

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
  'Boundary Zone'
]);
export type RegimeQuadrant = z.infer<typeof RegimeQuadrantSchema>;

export const RawIndicatorSchema = z.object({
  value: z.number(),
  unit: z.string(),
  asOf: z.string(),
  source: z.string(),
});
export type RawIndicator = z.infer<typeof RawIndicatorSchema>;

export const MacroIndicatorsSchema = z.record(z.string(), RawIndicatorSchema);
export type MacroIndicators = z.infer<typeof MacroIndicatorsSchema>;

export const PriorAssessmentSchema = z.object({
  regime_quadrant:   RegimeQuadrantSchema,
  inflation_score:   z.number(),
  growth_score:      z.number(),
  confidence:        z.number(),
  assessed_at:       z.string(),
});
export type PriorAssessment = z.infer<typeof PriorAssessmentSchema>;

export const PipelineInputSchema = z.object({
  indicators:       MacroIndicatorsSchema,
  priorAssessment:  PriorAssessmentSchema.nullable(),
  portfolioContext: z.any(), // Can be refined later if needed
  currentTime:     z.string().optional(),
  trigger:         z.enum(['scheduled', 'manual', 'alert', 'post_release']).optional(),
});
export type PipelineInput = z.infer<typeof PipelineInputSchema>;

export const NormalizedIndicatorSchema = z.object({
  key:                 z.string(),
  rawValue:            z.number(),
  unit:                z.string(),
  normalizedScore:     z.number(),
  effectiveWeight:     z.number(),
  originalWeight:      z.number(),
  weightedContribution: z.number(),
  asOf:                z.string(),
});
export type NormalizedIndicator = z.infer<typeof NormalizedIndicatorSchema>;

export const DataGapSchema = z.object({
  indicator:              z.string(),
  originalWeight:         z.number(),
  reason:                 z.enum(['missing', 'stale']),
  weightRedistributedTo:  z.array(z.string()),
});
export type DataGap = z.infer<typeof DataGapSchema>;

export const PipelineOutputSchema = z.object({
  inflationScore:  z.number(),
  growthScore:     z.number(),
  regimeQuadrant:  RegimeQuadrantSchema,
  confidence:      z.number(),
  requiresHumanReview: z.boolean(),
  flagReasons:     z.array(z.string()),
  regimeDriftVsPrior: z.enum(['Stable', 'Weakening', 'Transitioning', 'Shifted', 'N/A']),
  driftDelta:      z.object({ inflation: z.number(), growth: z.number() }).nullable(),
  dataGaps:        z.array(DataGapSchema),
  normalizedInflationIndicators: z.array(NormalizedIndicatorSchema),
  normalizedGrowthIndicators:    z.array(NormalizedIndicatorSchema),
  assessedAt:      z.string()
});

export const RegimeDriftSchema = z.enum(['Stable', 'Weakening', 'Transitioning', 'Shifted']);
export type RegimeDrift = z.infer<typeof RegimeDriftSchema>;

export const LLMResponseSchema = z.object({
  classificationVerdict:       z.enum(['Confirmed', 'Challenged', 'Nuanced']),
  challengeRationale:          z.string().nullable(),
  confidenceAdjustment:        z.number(),
  keyDrivers:                  z.array(z.string()),
  confirmingIndicators:        z.array(z.any()),
  contradictingIndicators:     z.array(z.any()),
  transitionSignal:            z.string(),
  centralThesisConflict:       z.string(),
  petrodollarRisk:             z.enum(['Active Risk', 'Latent Risk', 'Not Evidenced']),
  petrodollarRationale:        z.string(),
  fastestPathToBeingWrong:     z.string(),
  watchNext:                   z.array(z.any()),
  requiresHumanReviewOverride: z.boolean(),
  overrideReason:              z.string().nullable()
});

export const FinalAssessmentSchema = PipelineOutputSchema.merge(LLMResponseSchema).extend({
  finalConfidence: z.number(),
  finalHumanReview: z.boolean()
});

export type PipelineOutput = z.infer<typeof PipelineOutputSchema>;
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type FinalAssessment = z.infer<typeof FinalAssessmentSchema>;
export type RegimeAssessment = FinalAssessment; // Alias for compatibility
export const RegimeAssessmentSchema = FinalAssessmentSchema; // Alias for compatibility

// Alias for backward compatibility during migration
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

export interface SyncResult {
  updatedConfig: PortfolioConfig;
  alerts: Alert[];
}

export const ManualIndicatorSchema = z.object({
  value: z.number(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  updatedAt: z.string().datetime(),
  source: z.string(),
});
export type ManualIndicator = z.infer<typeof ManualIndicatorSchema>;

export const IndicatorBoundsSchema = z.object({
  low: z.number(),
  neutral: z.number(),
  high: z.number(),
});

export const RegimePipelineConfigSchema = z.object({
  inflation_bounds: z.record(z.string(), IndicatorBoundsSchema),
  growth_bounds: z.record(z.string(), IndicatorBoundsSchema),
  inflation_weights: z.record(z.string(), z.number()),
  growth_weights: z.record(z.string(), z.number()),
  regime_thresholds: z.object({
    inflation_high: z.number(),
    inflation_low: z.number(),
    growth_high: z.number(),
    growth_low: z.number(),
    boundary_zone: z.number(),
  }),
  staleness_limits_days: z.object({
    daily: z.number(),
    weekly: z.number(),
    monthly: z.number(),
    quarterly: z.number(),
  }),
});

export type RegimePipelineConfig = z.infer<typeof RegimePipelineConfigSchema>;

export const CoherenceOutputSchema = z.object({
  regimeMatch: z.enum(['Strong', 'Moderate', 'Weak', 'Conflicting']),
  correlationRisk: z.string(),
  thesisConflicts: z.array(z.string()),
  sizingNote: z.string(),
  verdict: z.enum(['Proceed', 'Reduce Size', 'Reconsider', 'Conflicts']),
  questionsBeforeEntry: z.array(z.string()).length(3),
});
export type CoherenceOutput = z.infer<typeof CoherenceOutputSchema>;

export const InterpreterOutputSchema = z.object({
  confirms: z.array(z.string()),
  contradicts: z.array(z.string()),
  ambiguous: z.array(z.string()),
  resolution_requirement: z.string(),
  summary_markdown: z.string(),
});
export type InterpreterOutput = z.infer<typeof InterpreterOutputSchema>;

export const EarningsEventSchema = z.object({
  symbol: z.string(),
  reportDate: z.string(),
  epsEstimate: z.number().nullable(),
  timeOfDay: z.enum(['pre', 'post', 'unknown']),
});
export type EarningsEvent = z.infer<typeof EarningsEventSchema>;
