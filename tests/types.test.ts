import { describe, it, expect } from 'vitest';
import { 
  PositionSnapshotSchema, 
  AlertSchema, 
  DataPointSchema, 
  MacroSnapshotSchema, 
  MacroCacheSchema, 
  RegimeQuadrantSchema, 
  RegimeAssessmentSchema,
  PositionConfigSchema,
  CoherenceOutputSchema,
  InterpreterOutputSchema,
  EarningsEventSchema,
  RawIndicatorSchema,
  ManualIndicatorSchema
} from '../src/types/index.js';

describe('PositionSnapshotSchema', () => {
  it('should validate a correct position snapshot', () => {
    const validPosition = {
      symbol: 'AAPL',
      quantity: 10,
      avg_cost: 150,
      market_price: 175,
      market_value: 1750,
      unrealized_pnl: 250,
      unrealized_pnl_pct: 16.67,
      fetched_at: new Date().toISOString(),
    };
    expect(PositionSnapshotSchema.safeParse(validPosition).success).toBe(true);
  });

  it('should reject invalid symbols', () => {
    const invalidPosition = { symbol: 123 }; // symbol should be a string
    expect(PositionSnapshotSchema.safeParse(invalidPosition).success).toBe(false);
  });
});

describe('AlertSchema', () => {
  it('should validate a correct alert', () => {
    const validAlert = {
      level: 'WARNING',
      symbol: 'BTC',
      message: 'Volatility high',
      action: 'Check positions',
      created_at: new Date().toISOString(),
    };
    expect(AlertSchema.safeParse(validAlert).success).toBe(true);
  });

  it('should validate without optional fields', () => {
    // Note: In our schema, symbol and action are nullable but must be present,
    // and created_at is mandatory.
    const minimalAlert = {
      level: 'INFO',
      symbol: null,
      message: 'System online',
      action: null,
      created_at: new Date().toISOString(),
    };
    expect(AlertSchema.safeParse(minimalAlert).success).toBe(true);
  });
});

describe('DataPointSchema', () => {
  it('should validate a correct data point', () => {
    const validPoint = { date: '2024-01-01', value: 100.5 };
    expect(DataPointSchema.safeParse(validPoint).success).toBe(true);
  });

  it('should reject invalid date formats', () => {
    expect(DataPointSchema.safeParse({ date: '01-01-2024', value: 10 }).success).toBe(false);
    expect(DataPointSchema.safeParse({ date: '2024/01/01', value: 10 }).success).toBe(false);
  });
});

describe('MacroSnapshotSchema', () => {
  it('should validate a correct macro snapshot', () => {
    const validSnapshot = {
      series: {
        'CPI': [{ date: '2024-01-01', value: 3.1 }],
        'GDP': [{ date: '2023-12-31', value: 2.5 }],
      },
      fetched_at: {
        'CPI': new Date().toISOString(),
        'GDP': new Date().toISOString(),
      }
    };
    expect(MacroSnapshotSchema.safeParse(validSnapshot).success).toBe(true);
  });
});

describe('MacroCacheSchema', () => {
  it('should validate a correct macro cache', () => {
    const validCache = {
      fetched_at: new Date().toISOString(),
      data: {
        series: {
          'CPI': [{ date: '2024-01-01', value: 3.1 }],
        },
        fetched_at: {
          'CPI': new Date().toISOString(),
        }
      },
    };
    expect(MacroCacheSchema.safeParse(validCache).success).toBe(true);
  });
});

describe('RegimeQuadrantSchema', () => {
  it('should validate all quadrants', () => {
    expect(RegimeQuadrantSchema.safeParse('Goldilocks').success).toBe(true);
    expect(RegimeQuadrantSchema.safeParse('Inflationary Boom').success).toBe(true);
    expect(RegimeQuadrantSchema.safeParse('Stagflation').success).toBe(true);
    expect(RegimeQuadrantSchema.safeParse('Deflationary Recession').success).toBe(true);
  });

  it('should reject invalid quadrants', () => {
    expect(RegimeQuadrantSchema.safeParse('Utopia').success).toBe(false);
  });
});

describe('RawIndicatorSchema', () => {
  it('should validate a correct raw indicator', () => {
    const validIndicator = {
      value: 3.1,
      unit: '% YoY',
      description: 'Consumer Price Index',
      as_of: '2024-01-01',
      source: 'BLS',
    };
    expect(RawIndicatorSchema.safeParse(validIndicator).success).toBe(true);
  });

  it('should reject if description is missing', () => {
    const invalidIndicator = {
      value: 3.1,
      unit: '% YoY',
      as_of: '2024-01-01',
      source: 'BLS',
    };
    expect(RawIndicatorSchema.safeParse(invalidIndicator).success).toBe(false);
  });
});

describe('ManualIndicatorSchema', () => {
  it('should validate a correct manual indicator', () => {
    const validIndicator = {
      value: 150,
      period: '2024-05',
      description: 'NFP Forecast',
      updated_at: new Date().toISOString(),
      source: 'manual',
    };
    expect(ManualIndicatorSchema.safeParse(validIndicator).success).toBe(true);
  });
});

describe('RegimeAssessmentSchema', () => {
  it('should validate a correct regime assessment', () => {
    const validAssessment = {
      // PipelineOutput fields
      inflation_score: 0.3,
      growth_score: 0.7,
      regime_quadrant: 'Goldilocks',
      confidence: 85,
      requires_human_review: false,
      flag_reasons: [],
      regime_drift_vs_prior: 'Stable',
      drift_delta: { inflation: 0.05, growth: -0.02 },
      data_gaps: [],
      normalized_inflation_indicators: [],
      normalized_growth_indicators: [],
      assessed_at: new Date().toISOString(),

      // LLMResponse fields
      classification_verdict: 'Confirmed-Strong',
      challenge_rationale: null,
      confidence_adjustment: 0,
      key_drivers: ['Low inflation', 'Moderate growth'],
      confirming_indicators: ['CPI stable'],
      contradicting_indicators: ['PPI rising'],
      transition_signal: 'Possible uptick in CPI',
      central_thesis_conflict: 'None',
      debasement_overlay: { score: 0, signal: 'None', indicators: { gold_real_rate_divergence: '', dxy_trend_vs_yield: '', treasury_auction_bid_cover: '', foreign_reserve_usd_share: '' } },
      fastest_path_to_being_wrong: 'Growth slowing faster than expected',
      watch_next: ['NFP'],
      requires_human_review_override: false,
      override_reason: null,

      // FinalAssessment extensions
      final_confidence: 85,
      final_human_review: false
    };
    const result = RegimeAssessmentSchema.safeParse(validAssessment);
    if (!result.success) {
      console.log(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('should validate without optional fields if any', () => {
    // Note: All fields in our schema seem to be mandatory except those marked optional
    const validAssessment = {
      inflation_score: 0.8,
      growth_score: 0.4,
      regime_quadrant: 'Stagflation',
      confidence: 70,
      requires_human_review: true,
      flag_reasons: ['High inflation'],
      regime_drift_vs_prior: 'Weakening',
      drift_delta: null,
      data_gaps: [{
        indicator: 'CPI',
        original_weight: 0.2,
        reason: 'missing',
        weight_redistributed_to: ['PCE']
      }],
      normalized_inflation_indicators: [],
      normalized_growth_indicators: [],
      assessed_at: new Date().toISOString(),

      classification_verdict: 'Nuanced',
      challenge_rationale: 'Inflation might be peaking',
      confidence_adjustment: -5,
      key_drivers: ['Rising prices', 'Stagnant growth'],
      confirming_indicators: [],
      contradicting_indicators: [],
      transition_signal: 'None',
      central_thesis_conflict: 'Conflict here',
      debasement_overlay: { score: 0, signal: 'None', indicators: { gold_real_rate_divergence: '', dxy_trend_vs_yield: '', treasury_auction_bid_cover: '', foreign_reserve_usd_share: '' } },
      fastest_path_to_being_wrong: 'Deflation spike',
      watch_next: [],
      requires_human_review_override: true,
      override_reason: 'High uncertainty',

      final_confidence: 65,
      final_human_review: true
    };
    const result = RegimeAssessmentSchema.safeParse(validAssessment);
    if (!result.success) {
      console.log(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });
});

describe('PositionConfigSchema', () => {
  it('should validate with optional fields', () => {
    const config = {
      description: 'Test description',
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
      description: 'Test description',
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

describe('CoherenceOutputSchema', () => {
  it('should validate a correct coherence output', () => {
    const validOutput = {
      regime_match: 'Strong',
      correlation_risk: 'Low',
      thesis_conflicts: [],
      sizing_note: 'Standard size',
      verdict: 'Proceed',
      questions_before_entry: ['Q1?', 'Q2?', 'Q3?'],
    };
    expect(CoherenceOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it('should reject if questions_before_entry does not have exactly 3 items', () => {
    const invalidOutput = {
      regime_match: 'Strong',
      correlation_risk: 'Low',
      thesis_conflicts: [],
      sizing_note: 'Standard size',
      verdict: 'Proceed',
      questions_before_entry: ['Q1?', 'Q2?'],
    };
    expect(CoherenceOutputSchema.safeParse(invalidOutput).success).toBe(false);
  });
});

describe('InterpreterOutputSchema', () => {
  it('should validate a correct interpreter output', () => {
    const validOutput = {
      confirms: ['A'],
      contradicts: ['B'],
      ambiguous: ['C'],
      resolution_requirement: 'Check D',
      summary_markdown: '# Summary',
    };
    expect(InterpreterOutputSchema.safeParse(validOutput).success).toBe(true);
  });
});

describe('EarningsEventSchema', () => {
  it('should validate a correct earnings event', () => {
    const validEvent = {
      symbol: 'AAPL',
      report_date: '2024-05-01',
      eps_estimate: 1.5,
      time_of_day: 'post',
    };
    expect(EarningsEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('should allow null eps_estimate', () => {
    const event = {
      symbol: 'TSLA',
      report_date: '2024-04-20',
      eps_estimate: null,
      time_of_day: 'post',
    };
    expect(EarningsEventSchema.safeParse(event).success).toBe(true);
  });

  it('should reject invalid time_of_day', () => {
    const invalidEvent = {
      symbol: 'MSFT',
      report_date: '2024-04-25',
      eps_estimate: 2.0,
      time_of_day: 'noon',
    };
    expect(EarningsEventSchema.safeParse(invalidEvent).success).toBe(false);
  });
});
