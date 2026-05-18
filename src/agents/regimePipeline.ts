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
  RawIndicator,
  RegimePipelineConfig
} from '../types/index.js';

const configPath = path.join(process.cwd(), 'config', 'regime_pipeline.json');
const CONFIG: RegimePipelineConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

type IndicatorFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type DataGapReason = 'missing' | 'stale';
export type DriftStatus = 'N/A' | 'Stable' | 'Weakening' | 'Transitioning' | 'Shifted';

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
  const frequency: IndicatorFrequency =
    INDICATOR_FREQUENCY[indicatorKey as keyof MacroIndicators] ?? 'monthly';
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
  indicators:   MacroIndicators | Record<string, any>,
  currentDate:  Date
): RedistributionResult {
  const gaps: DataGap[] = [];
  const excluded        = new Set<string>();
  let staleHighWeight   = false;

  for (const key of Object.keys(weights)) {
    const indicator = (indicators as any)[key];

    if (!indicator || typeof indicator === 'number') {
      // The test passes `indicators as any` with number values, so we handle it for backward compatibility in tests
      // But in real pipeline it's a RawIndicator object
      const val = typeof indicator === 'number' ? indicator : indicator?.value;
      if (val === undefined || val === null) {
        gaps.push({
          indicator:             key,
          originalWeight:        weights[key],
          reason:                'missing',
          weightRedistributedTo: [],
        });
        excluded.add(key);
        continue;
      }
    }

    if (indicator && typeof indicator === 'object' && indicator.asOf) {
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
    gap.weightRedistributedTo = availableKeys;
  }

  return { effectiveWeights, gaps, missingWeightTotal, staleHighWeight };
}

interface CategoryScoreResult {
  score:                number;
  normalizedIndicators: NormalizedIndicator[];
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

export function classifyQuadrant(
  inflationScore: number,
  growthScore:    number,
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

  const highInflation = inflationScore > inflation_high;
  const lowInflation  = inflationScore < inflation_low;
  const highGrowth    = growthScore    > growth_high;
  const lowGrowth     = growthScore    < growth_low;

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
  inflationScore:  number,
  growthScore:     number,
  currentQuadrant: RegimeQuadrant,
  prior:           PriorAssessment | null
): { status: DriftStatus; delta: PipelineOutput['driftDelta'] } {
  if (!prior) return { status: 'N/A', delta: null };

  // Handle both snake_case and camelCase for prior fields to be robust
  const priorInflation = (prior as any).inflation_score ?? (prior as any).inflationScore;
  const priorGrowth = (prior as any).growth_score ?? (prior as any).growthScore;
  const priorQuadrant = (prior as any).regime_quadrant ?? (prior as any).regimeQuadrant;

  const dInflation = Math.abs(inflationScore - priorInflation);
  const dGrowth    = Math.abs(growthScore    - priorGrowth);

  const delta = {
    inflation: round(inflationScore - priorInflation, 3),
    growth:    round(growthScore    - priorGrowth,    3),
  };

  if (currentQuadrant !== priorQuadrant) {
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
    crossedLine(priorInflation, inflationScore, iH) ||
    crossedLine(priorInflation, inflationScore, iL) ||
    crossedLine(priorGrowth,    growthScore,    gH) ||
    crossedLine(priorGrowth,    growthScore,    gL);

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

interface ConfidenceResult {
  score:               number;
  requiresHumanReview: boolean;
  flagReasons:         string[];
}

export function computeConfidence(params: {
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

  for (const gap of [...inflationGaps, ...growthGaps]) {
    if (gap.originalWeight >= 0.10) {
      confidence -= CONFIDENCE_PENALTIES.perMissingHighWeightIndicator;
    }
  }

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

  if (staleHighWeightFound) {
    confidence -= CONFIDENCE_PENALTIES.staleHighWeightIndicator;
    flagReasons.push('Stale data for indicator with weight >= 0.15');
  }

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
  const currentDate = new Date(input.currentTime ?? new Date().toISOString());

  const inflation = computeCategoryScore(
    CONFIG.inflation_weights, CONFIG.inflation_bounds, input.indicators, currentDate
  );
  const growth = computeCategoryScore(
    CONFIG.growth_weights, CONFIG.growth_bounds, input.indicators, currentDate
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
    regimeDriftVsPrior:             driftStatus as any,
    driftDelta,
    normalizedInflationIndicators:  inflation.normalizedIndicators,
    normalizedGrowthIndicators:     growth.normalizedIndicators,
    dataGaps:                       allGaps,
    assessedAt:                     currentDate.toISOString(),
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
    weighted_raw_indicators: extractRaw(input.indicators, WEIGHTED_KEYS),
    supplementary_indicators: extractRaw(input.indicators, SUPPLEMENTARY_KEYS),
    prior_assessment: input.priorAssessment,
    portfolio_context: input.portfolioContext,
    assessed_at: pipelineOutput.assessedAt,
  };

  return JSON.stringify(payload, null, 2);
}

export function mergePipelineAndLLM(
  pipeline: PipelineOutput,
  llm:      LLMResponse
): FinalAssessment {
  const finalConfidence = clamp(
    pipeline.confidence + llm.confidenceAdjustment,
    0,
    100
  );

  return {
    ...pipeline,
    ...llm,
    finalConfidence:   finalConfidence,
    finalHumanReview: pipeline.requiresHumanReview || llm.requiresHumanReviewOverride,
  };
}
