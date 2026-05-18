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
  EarningsEventSchema
} from '../src/types/index.js';

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
      createdAt: new Date().toISOString(),
    };
    expect(AlertSchema.safeParse(validAlert).success).toBe(true);
  });

  it('should validate without optional fields', () => {
    // Note: In our schema, symbol and action are nullable but must be present,
    // and createdAt is mandatory.
    const minimalAlert = {
      level: 'INFO',
      symbol: null,
      message: 'System online',
      action: null,
      createdAt: new Date().toISOString(),
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
      fetchedAt: {
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
      fetchedAt: new Date().toISOString(),
      data: {
        series: {
          'CPI': [{ date: '2024-01-01', value: 3.1 }],
        },
        fetchedAt: {
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

describe('RegimeAssessmentSchema', () => {
  it('should validate a correct regime assessment', () => {
    const validAssessment = {
      // PipelineOutput fields (camelCase)
      inflationScore: 0.3,
      growthScore: 0.7,
      regimeQuadrant: 'Goldilocks',
      confidence: 85,
      requiresHumanReview: false,
      flagReasons: [],
      regimeDriftVsPrior: 'Stable',
      driftDelta: { inflation: 0.05, growth: -0.02 },
      dataGaps: [],
      normalizedInflationIndicators: [],
      normalizedGrowthIndicators: [],
      assessedAt: new Date().toISOString(),

      // LLMResponse fields (camelCase)
      classificationVerdict: 'Confirmed',
      challengeRationale: null,
      confidenceAdjustment: 0,
      keyDrivers: ['Low inflation', 'Moderate growth'],
      confirmingIndicators: ['CPI stable'],
      contradictingIndicators: ['PPI rising'],
      transitionSignal: 'Possible uptick in CPI',
      centralThesisConflict: 'None',
      petrodollarRisk: 'Not Evidenced',
      petrodollarRationale: 'Stable',
      fastestPathToBeingWrong: 'Growth slowing faster than expected',
      watchNext: ['NFP'],
      requiresHumanReviewOverride: false,
      overrideReason: null,

      // FinalAssessment extensions
      finalConfidence: 85,
      finalHumanReview: false
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
      inflationScore: 0.8,
      growthScore: 0.4,
      regimeQuadrant: 'Stagflation',
      confidence: 70,
      requiresHumanReview: true,
      flagReasons: ['High inflation'],
      regimeDriftVsPrior: 'Weakening',
      driftDelta: null,
      dataGaps: [{
        indicator: 'CPI',
        originalWeight: 0.2,
        reason: 'missing',
        weightRedistributedTo: ['PCE']
      }],
      normalizedInflationIndicators: [],
      normalizedGrowthIndicators: [],
      assessedAt: new Date().toISOString(),

      classificationVerdict: 'Nuanced',
      challengeRationale: 'Inflation might be peaking',
      confidenceAdjustment: -5,
      keyDrivers: ['Rising prices', 'Stagnant growth'],
      confirmingIndicators: [],
      contradictingIndicators: [],
      transitionSignal: 'None',
      centralThesisConflict: 'Conflict here',
      petrodollarRisk: 'Latent Risk',
      petrodollarRationale: 'Rising tensions',
      fastestPathToBeingWrong: 'Deflation spike',
      watchNext: [],
      requiresHumanReviewOverride: true,
      overrideReason: 'High uncertainty',

      finalConfidence: 65,
      finalHumanReview: true
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

describe('CoherenceOutputSchema', () => {
  it('should validate a correct coherence output', () => {
    const validOutput = {
      regimeMatch: 'Strong',
      correlationRisk: 'Low',
      thesisConflicts: [],
      sizingNote: 'Standard size',
      verdict: 'Proceed',
      questionsBeforeEntry: ['Q1?', 'Q2?', 'Q3?'],
    };
    expect(CoherenceOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it('should reject if questionsBeforeEntry does not have exactly 3 items', () => {
    const invalidOutput = {
      regimeMatch: 'Strong',
      correlationRisk: 'Low',
      thesisConflicts: [],
      sizingNote: 'Standard size',
      verdict: 'Proceed',
      questionsBeforeEntry: ['Q1?', 'Q2?'],
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
      reportDate: '2024-05-01',
      epsEstimate: 1.5,
      timeOfDay: 'post',
    };
    expect(EarningsEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('should allow null epsEstimate', () => {
    const event = {
      symbol: 'TSLA',
      reportDate: '2024-04-20',
      epsEstimate: null,
      timeOfDay: 'post',
    };
    expect(EarningsEventSchema.safeParse(event).success).toBe(true);
  });

  it('should reject invalid timeOfDay', () => {
    const invalidEvent = {
      symbol: 'MSFT',
      reportDate: '2024-04-25',
      epsEstimate: 2.0,
      timeOfDay: 'noon',
    };
    expect(EarningsEventSchema.safeParse(invalidEvent).success).toBe(false);
  });
});
