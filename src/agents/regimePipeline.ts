import fs from 'fs';
import path from 'path';
import {
  RegimeQuadrant,
  PipelineInput,
  PipelineOutput,
  NormalizedIndicator,
  DataGap,
  LLMResponse,
  FinalAssessment,
  PriorAssessment,
  MacroIndicators,
  RegimePipelineConfig
} from '../types/index.js';
import { INDICATORS } from '../data/indicators/registry.js';
import { logger } from '../utils/logger.js';

const configPath = path.join(process.cwd(), 'config', 'regime_pipeline.json');
const CONFIG: RegimePipelineConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export type DriftStatus = 'N/A' | 'Stable' | 'Weakening' | 'Transitioning' | 'Shifted';

const CONFIDENCE_PENALTIES = {
  perMissingHighWeightIndicator: 8,   // per indicator with original weight >= 0.10
  missingCategoryWeightFloor:    0.30, // if missing >= this share of a category weight
  missingCategoryPenalty:        15,
  boundaryProximity:             10,
  staleHighWeightIndicator:      5,
  driftTransitioning:            8,
  driftShifted:                  12,
};

const CONFIDENCE_CAPS = {
  anyDataGap:        85,
  boundaryProximity: 70,
};

/**
 * Piecewise linear normalization to [0, 1].
 */
export function normalize(value: number, bounds: { low: number, neutral: number, high: number }): number {
  const { low, neutral, high } = bounds;
  if (value <= low)     return 0.0;
  if (value >= high)    return 1.0;
  if (value <= neutral) return 0.5 * (value - low) / (neutral - low);
  return 0.5 + 0.5 * (value - neutral) / (high - neutral);
}

export function isStale(
  asOf: string,
  indicatorKey: string,
  currentDate: Date
): boolean {
  const frequency = INDICATORS[indicatorKey]?.frequency ?? 'monthly';
  const limitDays = CONFIG.staleness_limits_days[frequency];
  const dataDate  = new Date(asOf);
  const ageDays   = (currentDate.getTime() - dataDate.getTime()) / 86_400_000;
  return ageDays > limitDays;
}

interface RedistributionResult {
  effectiveWeights:    Record<string, number>;
  gaps:                DataGap[];
  missingWeightTotal:  number;
  staleHighWeight:     boolean;
}

export function redistributeWeights(
  weights:      Record<string, number>,
  indicators:   MacroIndicators | Record<string, unknown>,
  currentDate:  Date
): RedistributionResult {
  const gaps: DataGap[] = [];
  const excluded        = new Set<string>();
  let staleHighWeight   = false;

  for (const key of Object.keys(weights)) {
    const indicator = indicators[key];

    if (!indicator || typeof indicator === 'number') {
      const val = typeof indicator === 'number'
        ? indicator
        : (indicator && typeof indicator === 'object' && 'value' in indicator)
          ? (indicator as { value: number }).value
          : undefined;
      if (val === undefined || val === null) {
        gaps.push({
          indicator:             key,
          original_weight:        weights[key],
          reason:                'missing',
          weight_redistributed_to: [],
        });
        excluded.add(key);
        continue;
      }
    }

    if (indicator && typeof indicator === 'object' && 'as_of' in indicator && typeof indicator.as_of === 'string') {
      if (isStale(indicator.as_of, key, currentDate)) {
        if (weights[key] >= 0.15) staleHighWeight = true;
        gaps.push({
          indicator:             key,
          original_weight:        weights[key],
          reason:                'stale',
          weight_redistributed_to: [],
        });
        excluded.add(key);
      }
    }
  }

  const availableKeys         = Object.keys(weights).filter(k => !excluded.has(k));
  const availableWeightTotal  = availableKeys.reduce((s, k) => s + weights[k], 0);
  const missingWeightTotal    = 1 - availableWeightTotal;

  const effectiveWeights: Record<string, number> = {};
  for (const key of availableKeys) {
    effectiveWeights[key] = availableWeightTotal > 0
      ? weights[key] / availableWeightTotal
      : 0;
  }

  for (const gap of gaps) {
    gap.weight_redistributed_to = availableKeys;
  }

  return { effectiveWeights, gaps, missingWeightTotal, staleHighWeight };
}

interface CategoryScoreResult {
  score:                number;
  normalized_indicators: NormalizedIndicator[];
  gaps:                 DataGap[];
  missingWeightTotal:   number;
  staleHighWeight:      boolean;
}

export function computeCategoryScore(
  weights:    Record<string, number>,
  bounds:     Record<string, { low: number, neutral: number, high: number }>,
  indicators: MacroIndicators,
  currentDate: Date
): CategoryScoreResult {
  const { effectiveWeights, gaps, missingWeightTotal, staleHighWeight } =
    redistributeWeights(weights, indicators, currentDate);

  const normalized_indicators: NormalizedIndicator[] = [];
  let score = 0;

  for (const [key, effectiveWeight] of Object.entries(effectiveWeights)) {
    const indicator = indicators[key];
    if (!indicator) continue;

    const normalizedScore     = normalize(indicator.value, bounds[key]);
    const weightedContribution = normalizedScore * effectiveWeight;
    score += weightedContribution;

    normalized_indicators.push({
      key,
      raw_value:             indicator.value,
      unit:                 indicator.unit,
      normalized_score:      round(normalizedScore,      3),
      effective_weight:      round(effectiveWeight,      3),
      original_weight:       round(weights[key],         3),
      weighted_contribution: round(weightedContribution, 3),
      as_of:                 indicator.as_of,
    });
  }

  return {
    score: round(score, 3),
    normalized_indicators,
    gaps,
    missingWeightTotal,
    staleHighWeight,
  };
}

export function classifyQuadrant(
  inflation_score: number,
  growth_score:    number,
  thresholds?: {
    inflation_high: number;
    inflation_low: number;
    growth_high: number;
    growth_low: number;
  }
): RegimeQuadrant {
  const th = thresholds || CONFIG.regime_thresholds;
  const {
    inflation_high, inflation_low,
    growth_high,    growth_low,
  } = th;

  const highInflation = inflation_score > inflation_high;
  const lowInflation  = inflation_score < inflation_low;
  const highGrowth    = growth_score    > growth_high;
  const lowGrowth     = growth_score    < growth_low;

  if (highInflation && highGrowth) return 'Inflationary Boom';
  if (highInflation && lowGrowth)  return 'Stagflation';
  if (lowInflation  && highGrowth) return 'Goldilocks';
  if (lowInflation  && lowGrowth)  return 'Deflationary Recession';

  return 'Boundary Zone';
}

function nearBoundary(score: number): boolean {
  const th = CONFIG.regime_thresholds;
  const {
    inflation_high, inflation_low,
    growth_high,    growth_low,
    boundary_zone,
  } = th;
  return [inflation_high, inflation_low, growth_high, growth_low].some(
    t => Math.abs(score - t) < boundary_zone
  );
}

export function detectDrift(
  inflation_score:  number,
  growth_score:     number,
  currentQuadrant: RegimeQuadrant,
  prior:           PriorAssessment | null
): { status: DriftStatus; delta: PipelineOutput['drift_delta'] } {
  if (!prior) return { status: 'N/A', delta: null };

  const prior_inflation = prior.inflation_score;
  const prior_growth = prior.growth_score;
  const prior_quadrant = prior.regime_quadrant;

  const d_inflation = Math.abs(inflation_score - prior_inflation);
  const d_growth    = Math.abs(growth_score    - prior_growth);

  const delta = {
    inflation: round(inflation_score - prior_inflation, 3),
    growth:    round(growth_score    - prior_growth,    3),
  };

  if (currentQuadrant !== prior_quadrant) {
    return { status: 'Shifted', delta };
  }

  const th = CONFIG.regime_thresholds;
  const thresholdsArr = [
    th.inflation_high,
    th.inflation_low,
    th.growth_high,
    th.growth_low,
  ];
  const [iH, iL, gH, gL] = thresholdsArr;
  const crossedThreshold =
    crossedLine(prior_inflation, inflation_score, iH) ||
    crossedLine(prior_inflation, inflation_score, iL) ||
    crossedLine(prior_growth,    growth_score,    gH) ||
    crossedLine(prior_growth,    growth_score,    gL);

  if (d_inflation > 0.15 || d_growth > 0.15 || crossedThreshold) {
    return { status: 'Transitioning', delta };
  }
  if (d_inflation >= 0.05 || d_growth >= 0.05) {
    return { status: 'Weakening', delta };
  }
  return { status: 'Stable', delta };
}

function crossedLine(from: number, to: number, threshold: number): boolean {
  return (from < threshold && to >= threshold) ||
         (from >= threshold && to < threshold);
}

interface ConfidenceResult {
  score:                  number;
  requires_human_review:   boolean;
  flag_reasons:            string[];
}

export function computeConfidence(params: {
  inflation_score:        number;
  growth_score:           number;
  inflation_gaps:         DataGap[];
  growth_gaps:            DataGap[];
  drift:                 DriftStatus;
  inflation_missing:      number;
  growth_missing:         number;
  stale_high_weight_found:  boolean;
  any_data_gaps:           boolean;
}): ConfidenceResult {
  const {
    inflation_score, growth_score,
    inflation_gaps, growth_gaps,
    drift, inflation_missing, growth_missing,
    stale_high_weight_found, any_data_gaps,
  } = params;

  let confidence       = 90;
  const flag_reasons: string[] = [];
  let requires_review   = false;

  for (const gap of [...inflation_gaps, ...growth_gaps]) {
    if (gap.original_weight >= 0.10) {
      confidence -= CONFIDENCE_PENALTIES.perMissingHighWeightIndicator;
    }
  }

  if (inflation_missing >= CONFIDENCE_PENALTIES.missingCategoryWeightFloor) {
    confidence -= CONFIDENCE_PENALTIES.missingCategoryPenalty;
    requires_review = true;
    flag_reasons.push(
      `Missing indicators cover ${pct(inflation_missing)} of inflation weight`
    );
  }
  if (growth_missing >= CONFIDENCE_PENALTIES.missingCategoryWeightFloor) {
    confidence -= CONFIDENCE_PENALTIES.missingCategoryPenalty;
    requires_review = true;
    flag_reasons.push(
      `Missing indicators cover ${pct(growth_missing)} of growth weight`
    );
  }

  const inflationBoundary = nearBoundary(inflation_score);
  const growthBoundary    = nearBoundary(growth_score);
  if (inflationBoundary || growthBoundary) {
    confidence -= CONFIDENCE_PENALTIES.boundaryProximity;
    requires_review = true;
    const dims = [
      inflationBoundary && 'inflation',
      growthBoundary    && 'growth',
    ].filter(Boolean).join(' and ');
    flag_reasons.push(`Score near threshold boundary: ${dims}`);
  }

  if (stale_high_weight_found) {
    confidence -= CONFIDENCE_PENALTIES.staleHighWeightIndicator;
    flag_reasons.push('Stale data for indicator with weight >= 0.15');
  }

  if (drift === 'Transitioning') {
    confidence -= CONFIDENCE_PENALTIES.driftTransitioning;
    requires_review = true;
    flag_reasons.push('Regime transitioning — elevated classification uncertainty');
  }
  if (drift === 'Shifted') {
    confidence -= CONFIDENCE_PENALTIES.driftShifted;
    requires_review = true;
    flag_reasons.push('Regime shifted since prior assessment');
  }

  if (any_data_gaps) {
    confidence = Math.min(confidence, CONFIDENCE_CAPS.anyDataGap);
  }
  if (inflationBoundary || growthBoundary) {
    confidence = Math.min(confidence, CONFIDENCE_CAPS.boundaryProximity);
  }

  const finalScore = clamp(confidence, 0, 100);
  const finalReview = requires_review || finalScore < 65;

  if (finalScore < 65 && !flag_reasons.includes('Confidence below threshold')) {
    flag_reasons.push(`Confidence below threshold: ${finalScore}`);
  }

  return {
    score:                  finalScore,
    requires_human_review:   finalReview,
    flag_reasons,
  };
}

export function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function runPipeline(input: PipelineInput): PipelineOutput {
  const currentDate = new Date(input.current_time ?? new Date().toISOString());

  const inflation = computeCategoryScore(
    CONFIG.inflation_weights, CONFIG.inflation_bounds, input.indicators, currentDate
  );
  const growth = computeCategoryScore(
    CONFIG.growth_weights, CONFIG.growth_bounds, input.indicators, currentDate
  );

  const regime_quadrant = classifyQuadrant(inflation.score, growth.score);

  const { status: driftStatus, delta: drift_delta } = detectDrift(
    inflation.score, growth.score, regime_quadrant, input.prior_assessment
  );

  const allGaps    = [...inflation.gaps, ...growth.gaps];
  const anyDataGaps = allGaps.length > 0;

  const { score: confidence, requires_human_review, flag_reasons } = computeConfidence({
    inflation_score:       inflation.score,
    growth_score:          growth.score,
    inflation_gaps:        inflation.gaps,
    growth_gaps:           growth.gaps,
    drift:                driftStatus,
    inflation_missing:     inflation.missingWeightTotal,
    growth_missing:        growth.missingWeightTotal,
    stale_high_weight_found: inflation.staleHighWeight || growth.staleHighWeight,
    any_data_gaps:         anyDataGaps,
  });

  return {
    inflation_score:  inflation.score,
    growth_score:     growth.score,
    regime_quadrant,
    confidence,
    requires_human_review,
    flag_reasons,
    regime_drift_vs_prior:             driftStatus,
    drift_delta,
    normalized_inflation_indicators:  inflation.normalized_indicators,
    normalized_growth_indicators:     growth.normalized_indicators,
    data_gaps:                       allGaps,
    assessed_at:                     currentDate.toISOString(),
  };
}

const WEIGHTED_KEYS: Set<string> = new Set([
  ...Object.keys(CONFIG.inflation_weights),
  ...Object.keys(CONFIG.growth_weights),
]);

const SUPPLEMENTARY_KEYS: string[] = [
  'fed_funds_rate_pct', 'yield_2y_pct', 'yield_10y_pct', 'yield_30y_pct',
  'tips_real_yield_5y_pct', 'yield_curve_10y_2y_bps', 'hy_spread_bps',
  'ig_spread_bps', 'dxy', 'gold_price_usd', 'wti_price_usd',
  'consumer_sentiment', 'personal_saving_rate_pct', 'capacity_utilization_pct',
  'real_wages_yoy_pct', 'fao_food_price_index',
  'forward_5y5y_pct', 'yield_curve_30_2', 'credit_spread_delta',
  'henry_hub_price_usd', 'm2_money_supply', 'retail_sales_ex_auto_pct',
  'industrial_production_index'
];

function extractRaw(
  indicators: MacroIndicators,
  keys: Iterable<string>
): Record<string, { value: number; unit: string; as_of: string }> {
  const result: Record<string, { value: number; unit: string; as_of: string }> = {};
  for (const key of keys) {
    const ind = indicators[key];
    if (ind) result[key] = { value: ind.value, unit: ind.unit, as_of: ind.as_of };
  }
  return result;
}

export function buildLLMInput(
  pipelineOutput: PipelineOutput,
  input:          PipelineInput
): string {
  const missingSupplementary = SUPPLEMENTARY_KEYS.filter(key => !(key in input.indicators));
  if (missingSupplementary.length > 0) {
    logger.warn({ missing: missingSupplementary }, 'Missing mandatory supplementary indicators');
  }

  const actualSupplementaryKeys = Object.keys(input.indicators).filter(key => !WEIGHTED_KEYS.has(key));

  const payload = {
    quantitative_assessment: {
      regime_quadrant:       pipelineOutput.regime_quadrant,
      inflation_score:       pipelineOutput.inflation_score,
      growth_score:          pipelineOutput.growth_score,
      confidence:            pipelineOutput.confidence,
      regime_drift_vs_prior: pipelineOutput.regime_drift_vs_prior,
      drift_delta:           pipelineOutput.drift_delta,
      requires_human_review: pipelineOutput.requires_human_review,
      flag_reasons:          pipelineOutput.flag_reasons,
      data_gaps:             pipelineOutput.data_gaps,
      normalized_inflation:  pipelineOutput.normalized_inflation_indicators,
      normalized_growth:     pipelineOutput.normalized_growth_indicators,
    },
    weighted_raw_indicators: extractRaw(input.indicators, WEIGHTED_KEYS),
    supplementary_indicators: extractRaw(input.indicators, actualSupplementaryKeys),
    prior_assessment: input.prior_assessment,
    portfolio_context: input.portfolio_context,
    assessed_at: pipelineOutput.assessed_at,
  };

  return JSON.stringify(payload, null, 2);
}

export function mergePipelineAndLLM(
  pipeline: PipelineOutput,
  llm:      LLMResponse
): FinalAssessment {
  const final_confidence = clamp(
    pipeline.confidence + llm.confidence_adjustment,
    0,
    100
  );

  return {
    ...pipeline,
    ...llm,
    final_confidence:   final_confidence,
    final_human_review: pipeline.requires_human_review || llm.requires_human_review_override,
  };
}
