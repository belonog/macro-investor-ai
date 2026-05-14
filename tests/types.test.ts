import { describe, it, expect } from 'vitest';
import { 
  PositionSnapshotSchema, 
  AlertSchema, 
  DataPointSchema, 
  MacroSnapshotSchema, 
  MacroCacheSchema, 
  RegimeQuadrantSchema, 
  RegimeSnapshotSchema 
} from '../src/data/types';

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
    };
    expect(AlertSchema.safeParse(validAlert).success).toBe(true);
  });

  it('should validate without optional fields', () => {
    const minimalAlert = {
      level: 'INFO',
      message: 'System online',
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
      'CPI': [{ date: '2024-01-01', value: 3.1 }],
      'GDP': [{ date: '2023-12-31', value: 2.5 }],
    };
    expect(MacroSnapshotSchema.safeParse(validSnapshot).success).toBe(true);
  });
});

describe('MacroCacheSchema', () => {
  it('should validate a correct macro cache', () => {
    const validCache = {
      fetchedAt: new Date().toISOString(),
      data: {
        'CPI': [{ date: '2024-01-01', value: 3.1 }],
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

describe('RegimeSnapshotSchema', () => {
  it('should validate a correct regime snapshot', () => {
    const validSnapshot = {
      quadrant: 'Goldilocks',
      confidence: 85,
      inflation_score: 0.3,
      growth_score: 0.7,
      regime_drift_vs_prior: 'Stable',
      keyDrivers: ['Low inflation', 'Moderate growth'],
      confirming_indicators: ['CPI stable'],
      contradicting_indicators: ['PPI rising'],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'Growth slowing faster than expected',
      watch_next: ['NFP'],
      transition_signal: 'Possible uptick in CPI',
      evaluatedAt: new Date().toISOString()
    };
    const result = RegimeSnapshotSchema.safeParse(validSnapshot);
    if (!result.success) {
      console.log(result.error);
    }
    expect(result.success).toBe(true);
  });

  it('should validate without optional transition_signal', () => {
    const validSnapshot = {
      quadrant: 'Stagflation',
      confidence: 70,
      inflation_score: 0.8,
      growth_score: 0.4,
      regime_drift_vs_prior: 'Weakening',
      keyDrivers: ['Rising prices', 'Stagnant growth'],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: 'Conflict here',
      fastest_path_to_being_wrong: 'Deflation spike',
      watch_next: [],
      evaluatedAt: new Date().toISOString()
    };
    const result = RegimeSnapshotSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
  });

  it('should reject confidence out of bounds', () => {
    const base = {
      quadrant: 'Goldilocks',
      inflation_score: 0.5,
      growth_score: 0.5,
      regime_drift_vs_prior: 'Stable',
      keyDrivers: ['Test'],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'None',
      watch_next: [],
      evaluatedAt: new Date().toISOString()
    };
    expect(RegimeSnapshotSchema.safeParse({ ...base, confidence: -1 }).success).toBe(false);
    expect(RegimeSnapshotSchema.safeParse({ ...base, confidence: 101 }).success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const invalidSnapshot = {
      quadrant: 'Goldilocks',
      confidence: 50,
      inflation_score: 0.5,
      growth_score: 0.5,
      regime_drift_vs_prior: 'Stable',
      keyDrivers: ['Test'],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'None',
      watch_next: [],
      evaluatedAt: 'not-a-date'
    };
    expect(RegimeSnapshotSchema.safeParse(invalidSnapshot).success).toBe(false);
  });
});
