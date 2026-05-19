/**
 * regime-pipeline.ts
 * Macro Regime Classification — Quantitative Pipeline
 *
 * Responsibility: all deterministic math before the LLM is invoked.
 * The LLM receives pre-computed scores and does interpretation only.
 *
 * Backtesting calibration: edit the CONFIG section only.
 * Nothing else should change between backtesting iterations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RegimeQuadrant =
  | 'Stagflation'
  | 'Inflationary Boom'
  | 'Goldilocks'
  | 'Deflationary Recession'
  | 'Boundary Zone'; // score sits between thresholds — ambiguous

export type DriftStatus = 'N/A' | 'Stable' | 'Weakening' | 'Transitioning' | 'Shifted';

export type DataGapReason = 'missing' | 'stale';

export type IndicatorFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface RawIndicator {
  value: number;
  unit: string;    // e.g. "% YoY", "index", "USD/bbl"
  asOf: string;   // YYYY-MM-DD
  source: string;
}

/** All values must be rates/percentages, NOT raw index levels. */
export interface MacroIndicators {
  // ── Inflation (weighted in regime score) ──────────────────────────────────
  cpi_yoy_pct?:                    RawIndicator; // CPI YoY %
  pce_yoy_pct?:                    RawIndicator; // PCE YoY %
  breakeven_5y_pct?:               RawIndicator; // 5Y Breakeven Inflation Rate %
  forward_5y5y_pct?:               RawIndicator; // 5Y5Y Forward Inflation Expectation %
  ppi_yoy_pct?:                    RawIndicator; // PPI YoY %
  oil_price_3m_change_pct?:        RawIndicator; // WTI 3-month % change
  fertilizer_index_3m_change_pct?: RawIndicator; // Fertilizer index 3-month % change

  // ── Growth (weighted in regime score) ────────────────────────────────────
  ism_manufacturing?:              RawIndicator; // ISM Manufacturing PMI (>50 = expansion)
  ism_services?:                   RawIndicator; // ISM Services PMI
  real_gdp_qoq_ann_pct?:           RawIndicator; // Real GDP QoQ annualized %
  nfp_3m_avg_k?:                   RawIndicator; // NFP 3-month average in thousands
  retail_sales_yoy_real_pct?:      RawIndicator; // Real retail sales YoY %

  // ── Supplementary (context for LLM interpretation — not weighted) ─────────
  fed_funds_rate_pct?:             RawIndicator;
  yield_2y_pct?:                   RawIndicator;
  yield_10y_pct?:                  RawIndicator;
  yield_30y_pct?:                  RawIndicator;
  tips_real_yield_5y_pct?:         RawIndicator;
  yield_curve_10y_2y_bps?:         RawIndicator;
  hy_spread_bps?:                  RawIndicator;
  ig_spread_bps?:                  RawIndicator;
  dxy?:                            RawIndicator;
  gold_price_usd?:                 RawIndicator;
  wti_price_usd?:                  RawIndicator;
  consumer_sentiment?:             RawIndicator;
  personal_saving_rate_pct?:       RawIndicator;
  capacity_utilization_pct?:       RawIndicator;
  real_wages_yoy_pct?:             RawIndicator;
}

export interface PriorAssessment {
  regime_quadrant:   RegimeQuadrant;
  inflation_score:   number;
  growth_score:      number;
  confidence:        number;
  assessed_at:       string; // ISO 8601
}

export interface PortfolioPosition {
  ticker:           string;
  description:      string;
  thesis_regime:    string;
  thesis_narrative: string;
  stop?:            number | null;
  hard_exit?:       number | null;
  notes?:           string;
}

export interface PortfolioContext {
  positions: PortfolioPosition[];
  secondary_risks: Array<{
    risk:                  string;
    description:           string;
    positions_at_risk:     string[];
    assessment_instruction: string;
  }>;
}

export interface PipelineInput {
  indicators:       MacroIndicators;
  priorAssessment:  PriorAssessment | null;
  portfolioContext: PortfolioContext;
  currentTime?:     string; // ISO 8601; defaults to now
  trigger?:         'scheduled' | 'manual' | 'alert';
}

export interface NormalizedIndicator {
  key:                 string;
  rawValue:            number;
  unit:                string;
  normalizedScore:     number; // 0.0–1.0
  effectiveWeight:     number; // after redistribution
  originalWeight:      number;
  weightedContribution: number;
  asOf:                string;
}

export interface DataGap {
  indicator:              string;
  originalWeight:         number;
  reason:                 DataGapReason;
  weightRedistributedTo:  string[];
}

export interface PipelineOutput {
  // Core scores (passed to LLM)
  inflationScore:  number;
  growthScore:     number;
  regimeQuadrant:  RegimeQuadrant;

  // Confidence and review flags (merged with LLM override in final output)
  confidence:           number;
  requiresHumanReview:  boolean;
  flagReasons:          string[];

  // Drift
  regimeDriftVsPrior:  DriftStatus;
  driftDelta:          { inflation: number; growth: number } | null;

  // Audit trail (transparency for LLM and for debugging)
  normalizedInflationIndicators: NormalizedIndicator[];
  normalizedGrowthIndicators:    NormalizedIndicator[];
  dataGaps:                      DataGap[];

  assessedAt: string;
}

import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'config', 'regime_pipeline.json');
const CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const INFLATION_BOUNDS = CONFIG.inflation_bounds;
const GROWTH_BOUNDS = CONFIG.growth_bounds;
const INFLATION_WEIGHTS = CONFIG.inflation_weights;
const GROWTH_WEIGHTS = CONFIG.growth_weights;
const REGIME_THRESHOLDS = CONFIG.regime_thresholds;
const STALENESS_LIMITS_DAYS = CONFIG.staleness_limits_days;

const INDICATOR_FREQUENCY: Partial<Record<keyof MacroIndicators, IndicatorFrequency>> = {
  cpi_yoy_pct:                    'monthly',
  pce_yoy_pct:                    'monthly',
  breakeven_5y_pct:               'daily',
  forward_5y5y_pct:               'daily',
  ppi_yoy_pct:                    'monthly',
  oil_price_3m_change_pct:        'daily',
  fertilizer_index_3m_change_pct: 'monthly',
  ism_manufacturing:              'monthly',
  ism_services:                   'monthly',
  real_gdp_qoq_ann_pct:           'quarterly',
  nfp_3m_avg_k:                   'monthly',
  retail_sales_yoy_real_pct:      'monthly',
};

const CONFIDENCE_PENALTIES = {
  perMissingHighWeightIndicator: 8,   // per indicator with original weight ≥ 0.10
  missingCategoryWeightFloor:    0.30, // if missing ≥ this share of a category weight
  missingCategoryPenalty:        15,
  boundaryProximity:             10,
  staleHighWeightIndicator:      5,
  driftTransitioning:            8,
  driftShifted:                  12,
};

// Max confidence when data is incomplete or boundary is near
const CONFIDENCE_CAPS = {
  anyDataGap:        85,
  boundaryProximity: 70,
};

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Piecewise linear normalization to [0, 1].
 *
 * Below neutral → maps [low, neutral] to [0.0, 0.5]
 * Above neutral → maps [neutral, high] to [0.5, 1.0]
 *
 * Clamped at 0.0 and 1.0.
 */
function normalize(value: number, bounds: IndicatorBounds): number {
  const { low, neutral, high } = bounds;
  if (value <= low)     return 0.0;
  if (value >= high)    return 1.0;
  if (value <= neutral) return 0.5 * (value - low) / (neutral - low);
  return 0.5 + 0.5 * (value - neutral) / (high - neutral);
}

// ─────────────────────────────────────────────────────────────────────────────
// STALENESS
// ─────────────────────────────────────────────────────────────────────────────

function isStale(
  asOf: string,
  indicatorKey: string,
  currentDate: Date
): boolean {
  const frequency: IndicatorFrequency =
    INDICATOR_FREQUENCY[indicatorKey as keyof MacroIndicators] ?? 'monthly';
  const limitDays = STALENESS_LIMITS_DAYS[frequency];
  const dataDate  = new Date(asOf);
  const ageDays   = (currentDate.getTime() - dataDate.getTime()) / 86_400_000;
  return ageDays > limitDays;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHT REDISTRIBUTION
// Excludes missing/stale indicators; redistributes their weight proportionally.
// ─────────────────────────────────────────────────────────────────────────────

interface RedistributionResult {
  effectiveWeights:    Record<string, number>;
  gaps:                DataGap[];
  missingWeightTotal:  number; // fraction of category weight that was missing
  staleHighWeight:     boolean;
}

function redistributeWeights(
  weights:      Record<string, number>,
  indicators:   MacroIndicators,
  currentDate:  Date
): RedistributionResult {
  const gaps: DataGap[] = [];
  const excluded        = new Set<string>();
  let staleHighWeight   = false;

  // Identify excluded indicators
  for (const key of Object.keys(weights)) {
    const indicator = (indicators as Record<string, RawIndicator | undefined>)[key];

    if (!indicator) {
      gaps.push({
        indicator:             key,
        originalWeight:        weights[key],
        reason:                'missing',
        weightRedistributedTo: [],
      });
      excluded.add(key);
      continue;
    }

    if (isStale(indicator.asOf, key, currentDate)) {
      if (weights[key] >= 0.15) staleHighWeight = true;
      gaps.push({
        indicator:             key,
        originalWeight:        weights[key],
        reason:                'stale',
        weightRedistributedTo: [],
      });
      excluded.add(key);
    }
  }

  const availableKeys         = Object.keys(weights).filter(k => !excluded.has(k));
  const availableWeightTotal  = availableKeys.reduce((s, k) => s + weights[k], 0);
  const missingWeightTotal    = 1 - availableWeightTotal;

  // Proportional redistribution
  const effectiveWeights: Record<string, number> = {};
  for (const key of availableKeys) {
    effectiveWeights[key] = availableWeightTotal > 0
      ? weights[key] / availableWeightTotal
      : 0;
  }

  // Record redistribution targets in gaps
  for (const gap of gaps) {
    gap.weightRedistributedTo = availableKeys;
  }

  return { effectiveWeights, gaps, missingWeightTotal, staleHighWeight };
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY SCORE
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryScoreResult {
  score:                number;
  normalizedIndicators: NormalizedIndicator[];
  gaps:                 DataGap[];
  missingWeightTotal:   number;
  staleHighWeight:      boolean;
}

function computeCategoryScore(
  weights:    Record<string, number>,
  bounds:     Record<string, IndicatorBounds>,
  indicators: MacroIndicators,
  currentDate: Date
): CategoryScoreResult {
  const { effectiveWeights, gaps, missingWeightTotal, staleHighWeight } =
    redistributeWeights(weights, indicators, currentDate);

  const normalizedIndicators: NormalizedIndicator[] = [];
  let score = 0;

  for (const [key, effectiveWeight] of Object.entries(effectiveWeights)) {
    const indicator = (indicators as Record<string, RawIndicator | undefined>)[key];
    if (!indicator) continue;

    const normalizedScore     = normalize(indicator.value, bounds[key]);
    const weightedContribution = normalizedScore * effectiveWeight;
    score += weightedContribution;

    normalizedIndicators.push({
      key,
      rawValue:             indicator.value,
      unit:                 indicator.unit,
      normalizedScore:      round(normalizedScore,      3),
      effectiveWeight:      round(effectiveWeight,      3),
      originalWeight:       round(weights[key],         3),
      weightedContribution: round(weightedContribution, 3),
      asOf:                 indicator.asOf,
    });
  }

  return {
    score: round(score, 3),
    normalizedIndicators,
    gaps,
    missingWeightTotal,
    staleHighWeight,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REGIME CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

function classifyQuadrant(
  inflationScore: number,
  growthScore:    number
): RegimeQuadrant {
  const {
    inflationHigh, inflationLow,
    growthHigh,    growthLow,
  } = REGIME_THRESHOLDS;

  const highInflation = inflationScore > inflationHigh;
  const lowInflation  = inflationScore < inflationLow;
  const highGrowth    = growthScore    > growthHigh;
  const lowGrowth     = growthScore    < growthLow;

  if (highInflation && highGrowth) return 'Inflationary Boom';
  if (highInflation && lowGrowth)  return 'Stagflation';
  if (lowInflation  && highGrowth) return 'Goldilocks';
  if (lowInflation  && lowGrowth)  return 'Deflationary Recession';

  return 'Boundary Zone';
}

function nearBoundary(score: number): boolean {
  const {
    inflationHigh, inflationLow,
    growthHigh,    growthLow,
    boundaryZone,
  } = REGIME_THRESHOLDS;
  return [inflationHigh, inflationLow, growthHigh, growthLow].some(
    t => Math.abs(score - t) < boundaryZone
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIFT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

function detectDrift(
  inflationScore:  number,
  growthScore:     number,
  currentQuadrant: RegimeQuadrant,
  prior:           PriorAssessment | null
): { status: DriftStatus; delta: PipelineOutput['driftDelta'] } {
  if (!prior) return { status: 'N/A', delta: null };

  const dInflation = Math.abs(inflationScore - prior.inflation_score);
  const dGrowth    = Math.abs(growthScore    - prior.growth_score);

  const delta = {
    inflation: round(inflationScore - prior.inflation_score, 3),
    growth:    round(growthScore    - prior.growth_score,    3),
  };

  if (currentQuadrant !== prior.regime_quadrant) {
    return { status: 'Shifted', delta };
  }

  // Check if either score has crossed a threshold since the prior run
  const thresholds = [
    REGIME_THRESHOLDS.inflationHigh,
    REGIME_THRESHOLDS.inflationLow,
    REGIME_THRESHOLDS.growthHigh,
    REGIME_THRESHOLDS.growthLow,
  ];
  const [iH, iL, gH, gL] = thresholds;
  const crossedThreshold =
    crossedLine(prior.inflation_score, inflationScore, iH) ||
    crossedLine(prior.inflation_score, inflationScore, iL) ||
    crossedLine(prior.growth_score,    growthScore,    gH) ||
    crossedLine(prior.growth_score,    growthScore,    gL);

  if (dInflation > 0.15 || dGrowth > 0.15 || crossedThreshold) {
    return { status: 'Transitioning', delta };
  }
  if (dInflation >= 0.05 || dGrowth >= 0.05) {
    return { status: 'Weakening', delta };
  }
  return { status: 'Stable', delta };
}

function crossedLine(from: number, to: number, threshold: number): boolean {
  return (from < threshold && to >= threshold) ||
         (from >= threshold && to < threshold);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE & FLAGGING
// ─────────────────────────────────────────────────────────────────────────────

interface ConfidenceResult {
  score:               number;
  requiresHumanReview: boolean;
  flagReasons:         string[];
}

function computeConfidence(params: {
  inflationScore:        number;
  growthScore:           number;
  inflationGaps:         DataGap[];
  growthGaps:            DataGap[];
  drift:                 DriftStatus;
  inflationMissing:      number;
  growthMissing:         number;
  staleHighWeightFound:  boolean;
  anyDataGaps:           boolean;
}): ConfidenceResult {
  const {
    inflationScore, growthScore,
    inflationGaps, growthGaps,
    drift, inflationMissing, growthMissing,
    staleHighWeightFound, anyDataGaps,
  } = params;

  let confidence       = 90;
  const flagReasons: string[] = [];
  let requiresReview   = false;

  // Missing high-weight indicators
  for (const gap of [...inflationGaps, ...growthGaps]) {
    if (gap.originalWeight >= 0.10) {
      confidence -= CONFIDENCE_PENALTIES.perMissingHighWeightIndicator;
    }
  }

  // Missing ≥30% of category weight
  if (inflationMissing >= CONFIDENCE_PENALTIES.missingCategoryWeightFloor) {
    confidence -= CONFIDENCE_PENALTIES.missingCategoryPenalty;
    requiresReview = true;
    flagReasons.push(
      `Missing indicators cover ${pct(inflationMissing)} of inflation weight`
    );
  }
  if (growthMissing >= CONFIDENCE_PENALTIES.missingCategoryWeightFloor) {
    confidence -= CONFIDENCE_PENALTIES.missingCategoryPenalty;
    requiresReview = true;
    flagReasons.push(
      `Missing indicators cover ${pct(growthMissing)} of growth weight`
    );
  }

  // Boundary proximity
  const inflationBoundary = nearBoundary(inflationScore);
  const growthBoundary    = nearBoundary(growthScore);
  if (inflationBoundary || growthBoundary) {
    confidence -= CONFIDENCE_PENALTIES.boundaryProximity;
    requiresReview = true;
    const dims = [
      inflationBoundary && 'inflation',
      growthBoundary    && 'growth',
    ].filter(Boolean).join(' and ');
    flagReasons.push(`Score near threshold boundary: ${dims}`);
  }

  // Stale high-weight indicator
  if (staleHighWeightFound) {
    confidence -= CONFIDENCE_PENALTIES.staleHighWeightIndicator;
    flagReasons.push('Stale data for indicator with weight ≥ 0.15');
  }

  // Drift
  if (drift === 'Transitioning') {
    confidence -= CONFIDENCE_PENALTIES.driftTransitioning;
    requiresReview = true;
    flagReasons.push('Regime transitioning — elevated classification uncertainty');
  }
  if (drift === 'Shifted') {
    confidence -= CONFIDENCE_PENALTIES.driftShifted;
    requiresReview = true;
    flagReasons.push('Regime shifted since prior assessment');
  }

  // Confidence caps
  if (anyDataGaps) {
    confidence = Math.min(confidence, CONFIDENCE_CAPS.anyDataGap);
  }
  if (inflationBoundary || growthBoundary) {
    confidence = Math.min(confidence, CONFIDENCE_CAPS.boundaryProximity);
  }

  const finalScore = clamp(confidence, 0, 100);
  const finalReview = requiresReview || finalScore < 65;

  if (finalScore < 65 && !flagReasons.includes('Confidence below threshold')) {
    flagReasons.push(`Confidence below threshold: ${finalScore}`);
  }

  return {
    score:               finalScore,
    requiresHumanReview: finalReview,
    flagReasons,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export function runPipeline(input: PipelineInput): PipelineOutput {
  const currentDate = new Date(input.currentTime ?? new Date().toISOString());

  const inflation = computeCategoryScore(
    INFLATION_WEIGHTS, INFLATION_BOUNDS, input.indicators, currentDate
  );
  const growth = computeCategoryScore(
    GROWTH_WEIGHTS, GROWTH_BOUNDS, input.indicators, currentDate
  );

  const regimeQuadrant = classifyQuadrant(inflation.score, growth.score);

  const { status: driftStatus, delta: driftDelta } = detectDrift(
    inflation.score, growth.score, regimeQuadrant, input.priorAssessment
  );

  const allGaps    = [...inflation.gaps, ...growth.gaps];
  const anyDataGaps = allGaps.length > 0;

  const { score: confidence, requiresHumanReview, flagReasons } = computeConfidence({
    inflationScore:       inflation.score,
    growthScore:          growth.score,
    inflationGaps:        inflation.gaps,
    growthGaps:           growth.gaps,
    drift:                driftStatus,
    inflationMissing:     inflation.missingWeightTotal,
    growthMissing:        growth.missingWeightTotal,
    staleHighWeightFound: inflation.staleHighWeight || growth.staleHighWeight,
    anyDataGaps,
  });

  return {
    inflationScore:  inflation.score,
    growthScore:     growth.score,
    regimeQuadrant,
    confidence,
    requiresHumanReview,
    flagReasons,
    regimeDriftVsPrior:             driftStatus,
    driftDelta,
    normalizedInflationIndicators:  inflation.normalizedIndicators,
    normalizedGrowthIndicators:     growth.normalizedIndicators,
    dataGaps:                       allGaps,
    assessedAt:                     currentDate.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM INPUT BUILDER
// Serializes pipeline output + raw context into the user message for the LLM.
// The LLM never sees weights, bounds, or thresholds — only results and raw data.
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTED_KEYS = new Set([
  ...Object.keys(INFLATION_WEIGHTS),
  ...Object.keys(GROWTH_WEIGHTS),
]);

const SUPPLEMENTARY_KEYS: Array<keyof MacroIndicators> = [
  'fed_funds_rate_pct', 'yield_2y_pct', 'yield_10y_pct', 'yield_30y_pct',
  'tips_real_yield_5y_pct', 'yield_curve_10y_2y_bps', 'hy_spread_bps',
  'ig_spread_bps', 'dxy', 'gold_price_usd', 'wti_price_usd',
  'consumer_sentiment', 'personal_saving_rate_pct', 'capacity_utilization_pct',
  'real_wages_yoy_pct',
];

function extractRaw(
  indicators: MacroIndicators,
  keys: Iterable<string>
): Record<string, { value: number; unit: string; asOf: string }> {
  const result: Record<string, { value: number; unit: string; asOf: string }> = {};
  for (const key of keys) {
    const ind = (indicators as Record<string, RawIndicator | undefined>)[key];
    if (ind) result[key] = { value: ind.value, unit: ind.unit, asOf: ind.asOf };
  }
  return result;
}

export function buildLLMInput(
  pipelineOutput: PipelineOutput,
  input:          PipelineInput
): string {
  const payload = {
    /**
     * quantitative_assessment: pre-computed by the pipeline.
     * The LLM validates these — it does NOT recompute them.
     */
    quantitative_assessment: {
      regime_quadrant:       pipelineOutput.regimeQuadrant,
      inflation_score:       pipelineOutput.inflationScore,
      growth_score:          pipelineOutput.growthScore,
      confidence:            pipelineOutput.confidence,
      regime_drift_vs_prior: pipelineOutput.regimeDriftVsPrior,
      drift_delta:           pipelineOutput.driftDelta,
      requires_human_review: pipelineOutput.requiresHumanReview,
      flag_reasons:          pipelineOutput.flagReasons,
      data_gaps:             pipelineOutput.dataGaps,
      normalized_inflation:  pipelineOutput.normalizedInflationIndicators,
      normalized_growth:     pipelineOutput.normalizedGrowthIndicators,
    },

    /** Raw values for the weighted indicators — for LLM sanity-checking. */
    weighted_raw_indicators: extractRaw(input.indicators, WEIGHTED_KEYS),

    /** Context indicators not in the weighted model — used in Phase 2. */
    supplementary_indicators: extractRaw(input.indicators, SUPPLEMENTARY_KEYS),

    /** LLM uses this for drift narrative context only. */
    prior_assessment: input.priorAssessment,

    /** Sealed from the LLM until Phase 2 (enforced by system prompt). */
    portfolio_context: input.portfolioContext,

    assessed_at: pipelineOutput.assessedAt,
  };

  return JSON.stringify(payload, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL OUTPUT MERGER
// Combines pipeline output with LLM response into the stored assessment record.
// ─────────────────────────────────────────────────────────────────────────────

export interface LLMResponse {
  classification_verdict:       'Confirmed' | 'Challenged' | 'Nuanced';
  challenge_rationale:          string | null;
  confidence_adjustment:        number; // -10 to +10
  key_drivers:                  string[];
  confirming_indicators:        Array<{ indicator: string; value: string; signal: string }>;
  contradicting_indicators:     Array<{ indicator: string; value: string; signal: string }>;
  transition_signal:            string;
  central_thesis_conflict:      string;
  petrodollar_risk:             'Active Risk' | 'Latent Risk' | 'Not Evidenced';
  petrodollar_rationale:        string;
  fastest_path_to_being_wrong:  string;
  watch_next:                   Array<{ release: string; watch_for: string }>;
  requires_human_review_override: boolean;
  override_reason:              string | null;
}

export interface FinalAssessment extends PipelineOutput, LLMResponse {
  final_confidence:      number; // pipeline confidence + LLM adjustment, clamped
  final_human_review:    boolean;
}

export function mergePipelineAndLLM(
  pipeline: PipelineOutput,
  llm:      LLMResponse
): FinalAssessment {
  const finalConfidence = clamp(
    pipeline.confidence + llm.confidence_adjustment,
    0,
    100
  );

  return {
    ...pipeline,
    ...llm,
    final_confidence:   finalConfidence,
    final_human_review: pipeline.requiresHumanReview || llm.requires_human_review_override,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE EXAMPLE
// ─────────────────────────────────────────────────────────────────────────────

/*
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt'; // see system_prompt.md

const client = new Anthropic();

async function classifyRegime(input: PipelineInput): Promise<FinalAssessment> {
  // Step 1: Run deterministic pipeline
  const pipelineOutput = runPipeline(input);

  // Step 2: Build LLM user message
  const userMessage = buildLLMInput(pipelineOutput, input);

  // Step 3: Invoke LLM for interpretation
  const response = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userMessage }],
  });

  const llmText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const llmResponse: LLMResponse = JSON.parse(llmText);

  // Step 4: Merge and return
  return mergePipelineAndLLM(pipelineOutput, llmResponse);
}
*/
