import { describe, it, expect } from 'vitest';
import { 
  normalize, 
  redistributeWeights, 
  classifyQuadrant, 
  runPipeline, 
  detectDrift, 
  computeConfidence,
  isStale,
  buildLLMInput,
  mergePipelineAndLLM
} from '../src/agents/regimePipeline.js';
import { PipelineOutput, LLMResponse, RegimeAssessment } from '../src/types/index.js';

describe('regimePipeline - normalization', () => {
  const bounds = { low: 0, neutral: 2.0, high: 7.0 };

  it('normalizes values below neutral', () => {
    expect(normalize(0, bounds)).toBe(0);
    expect(normalize(1.0, bounds)).toBe(0.25);
    expect(normalize(2.0, bounds)).toBe(0.5);
  });

  it('normalizes values above neutral', () => {
    expect(normalize(4.5, bounds)).toBe(0.75);
    expect(normalize(7.0, bounds)).toBe(1.0);
  });

  it('clamps values outside bounds', () => {
    expect(normalize(-1, bounds)).toBe(0);
    expect(normalize(10, bounds)).toBe(1.0);
  });
});

describe('regimePipeline - weight redistribution', () => {
  const weights = {
    a: 0.5,
    b: 0.3,
    c: 0.2
  };

  it('returns original weights when all indicators present', () => {
    const indicators = { a: 1, b: 2, c: 3 };
    const { effectiveWeights, gaps } = redistributeWeights(weights, indicators, new Date());
    expect(effectiveWeights).toEqual(weights);
    expect(gaps).toHaveLength(0);
  });

  it('redistributes weights when an indicator is missing', () => {
    const indicators = { a: 1, c: 3 }; // b is missing
    const { effectiveWeights, gaps } = redistributeWeights(weights, indicators, new Date());
    
    expect(effectiveWeights.a).toBeCloseTo(0.5 / 0.7);
    expect(effectiveWeights.c).toBeCloseTo(0.2 / 0.7);
    expect(effectiveWeights.b).toBeUndefined();
    
    expect(gaps).toHaveLength(1);
    expect(gaps[0].indicator).toBe('b');
    expect(gaps[0].weight_redistributed_to).toEqual(['a', 'c']);
  });
});

describe('regimePipeline - classifyQuadrant', () => {
  const thresholds = {
    inflation_high: 0.6,
    inflation_low: 0.4,
    growth_high: 0.55,
    growth_low: 0.45,
    boundary_zone: 0.05
  };

  it('classifies Goldilocks', () => {
    expect(classifyQuadrant(0.3, 0.6, thresholds)).toBe('Goldilocks');
  });

  it('classifies Inflationary Boom', () => {
    expect(classifyQuadrant(0.7, 0.6, thresholds)).toBe('Inflationary Boom');
  });

  it('classifies Stagflation', () => {
    expect(classifyQuadrant(0.7, 0.3, thresholds)).toBe('Stagflation');
  });

  it('classifies Deflationary Recession', () => {
    expect(classifyQuadrant(0.3, 0.3, thresholds)).toBe('Deflationary Recession');
  });

  it('classifies Boundary Zone', () => {
    expect(classifyQuadrant(0.5, 0.5, thresholds)).toBe('Boundary Zone');
  });
});

describe('regimePipeline - runPipeline', () => {
  it('runs the full pipeline successfully', () => {
    const indicators = {
      cpi_yoy_pct: { value: 3.0, unit: '%', as_of: '2026-05-15', source: 'fred' },
      pce_yoy_pct: { value: 2.5, unit: '%', as_of: '2026-05-15', source: 'fred' },
      breakeven_5y_pct: { value: 2.2, unit: '%', as_of: '2026-05-15', source: 'fred' },
      ppi_yoy_pct: { value: 2.1, unit: '%', as_of: '2026-05-15', source: 'fred' },
      oil_price_3m_change_pct: { value: 5.0, unit: '%', as_of: '2026-05-15', source: 'eia' },
      fertilizer_index_3m_change_pct: { value: 2.0, unit: '%', as_of: '2026-05-15', source: 'bls' },
      ism_manufacturing: { value: 52.0, unit: 'index', as_of: '2026-05-15', source: 'ism' },
      ism_services: { value: 54.0, unit: 'index', as_of: '2026-05-15', source: 'ism' },
      real_gdp_qoq_ann_pct: { value: 2.1, unit: '%', as_of: '2026-05-15', source: 'bea' },
      nfp_3m_avg_k: { value: 200, unit: 'k', as_of: '2026-05-15', source: 'bls' },
      retail_sales_yoy_real_pct: { value: 2.5, unit: '%', as_of: '2026-05-15', source: 'census' },
    };
    
    const input = {
      indicators,
      prior_assessment: null,
      portfolio_context: { positions: [], secondary_risks: [] },
      current_time: '2026-05-16T12:00:00Z'
    };
    
    const output = runPipeline(input);
    
    expect(output.inflation_score).toBeDefined();
    expect(output.growth_score).toBeDefined();
    expect(output.regime_quadrant).toBeDefined();
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.assessed_at).toBe('2026-05-16T12:00:00.000Z');
  });
});

describe('regimePipeline - detectDrift', () => {
  const prior = {
    regime_quadrant: 'Goldilocks',
    inflation_score: 0.3,
    growth_score: 0.6,
    confidence: 90,
    assessed_at: '2026-05-10T12:00:00Z'
  } satisfies Partial<RegimeAssessment>;

  it('returns Stable when scores are similar', () => {
    const { status } = detectDrift(0.32, 0.62, 'Goldilocks', prior);
    expect(status).toBe('Stable');
  });

  it('returns Weakening when scores drift moderately', () => {
    // Inflation 0.3 -> 0.36 (diff 0.06)
    // Growth 0.6 stays Goldilocks
    const { status } = detectDrift(0.36, 0.6, 'Goldilocks', prior);
    expect(status).toBe('Weakening');
  });

  it('returns Transitioning when a threshold is crossed', () => {
    // Growth 0.6 -> 0.76 (diff 0.16)
    // Both stay in Goldilocks
    const { status } = detectDrift(0.3, 0.76, 'Goldilocks', prior);
    expect(status).toBe('Transitioning');
  });

  it('returns Shifted when quadrant changes', () => {
    const { status } = detectDrift(0.7, 0.3, 'Stagflation', prior);
    expect(status).toBe('Shifted');
  });
});

describe('regimePipeline - computeConfidence', () => {
  it('returns high confidence for complete data', () => {
    const { score } = computeConfidence({
      inflation_score: 0.2, 
      growth_score: 0.8,
      inflation_gaps: [],
      growth_gaps: [],
      drift: 'Stable',
      inflation_missing: 0,
      growth_missing: 0,
      stale_high_weight_found: false,
      any_data_gaps: false
    });
    expect(score).toBe(90);
  });

  it('penalizes for missing high weight indicators', () => {
    const { score } = computeConfidence({
      inflation_score: 0.2,
      growth_score: 0.8,
      inflation_gaps: [{ indicator: 'pce_yoy_pct', original_weight: 0.20, reason: 'missing', weight_redistributed_to: [] }],
      growth_gaps: [],
      drift: 'Stable',
      inflation_missing: 0.20,
      growth_missing: 0,
      stale_high_weight_found: false,
      any_data_gaps: true
    });
    expect(score).toBe(82);
  });
});

describe('regimePipeline - helpers', () => {
  it('isStale correctly identifies stale data', () => {
    const currentDate = new Date('2026-05-15T12:00:00Z');
    const staleDate = '2026-01-01'; // ~134 days old, stale for monthly (90d)
    const freshDate = '2026-05-10'; 
    
    expect(isStale(staleDate, 'cpi_yoy_pct', currentDate)).toBe(true);
    expect(isStale(freshDate, 'cpi_yoy_pct', currentDate)).toBe(false);
  });

  it('buildLLMInput produces valid JSON', () => {
    const indicators = {
      cpi_yoy_pct: { value: 3.0, unit: '%', as_of: '2026-05-15', source: 'fred' },
    };
    const input = {
      indicators,
      prior_assessment: null,
      portfolio_context: { positions: [], secondary_risks: [] },
    };
    const output = runPipeline(input);
    const llmInput = buildLLMInput(output, input);
    const parsed = JSON.parse(llmInput);
    expect(parsed.quantitative_assessment.regime_quadrant).toBe(output.regime_quadrant);
    expect(parsed.weighted_raw_indicators.cpi_yoy_pct.value).toBe(3.0);
  });

  it('mergePipelineAndLLM correctly adjusts confidence', () => {
    const pipeline = {
      inflation_score: 0.5,
      growth_score: 0.5,
      regime_quadrant: 'Goldilocks',
      confidence: 80,
      requires_human_review: false,
      flag_reasons: [],
      regime_drift_vs_prior: 'Stable',
      drift_delta: null,
      data_gaps: [],
      normalized_inflation_indicators: [],
      normalized_growth_indicators: [],
      assessed_at: '2026-05-15T12:00:00Z',
    } satisfies PipelineOutput;
    const llm = {
      classification_verdict: 'Confirmed',
      challenge_rationale: null,
      confidence_adjustment: 5,
      requires_human_review_override: true,
      key_drivers: [],
      confirming_indicators: [],
      contradicting_indicators: [],
      transition_signal: 'None',
      central_thesis_conflict: 'None',
      petrodollar_risk: 'Not Evidenced',
      petrodollar_rationale: 'None',
      fastest_path_to_being_wrong: 'Nothing',
      watch_next: [],
      override_reason: null
    } satisfies LLMResponse;
    const final = mergePipelineAndLLM(pipeline, llm);
    expect(final.final_confidence).toBe(85);
    expect(final.final_human_review).toBe(true);
  });
});
