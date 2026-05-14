import { describe, it, expect } from 'vitest';
import { 
  PositionSnapshotSchema, 
  AlertSchema, 
  DataPointSchema, 
  MacroSnapshotSchema,
  RegimeQuadrantSchema,
  RegimeSnapshotSchema
} from '../src/data/types.js';

describe('PositionSnapshotSchema', () => {
  it('should validate a correct position snapshot', () => {
    const validSnapshot = {
      symbol: 'AAPL',
      quantity: 10,
      avgCost: 150.5,
      marketPrice: 175.2,
      marketValue: 1752.0,
      unrealizedPnl: 247.0,
      unrealizedPnlPct: 0.164,
      fetchedAt: new Date().toISOString()
    };
    const result = PositionSnapshotSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
  });

  it('should reject a snapshot with missing fields', () => {
    const invalidSnapshot = {
      symbol: 'AAPL',
      quantity: 10
    };
    const result = PositionSnapshotSchema.safeParse(invalidSnapshot);
    expect(result.success).toBe(false);
  });

  it('should reject a snapshot with wrong types', () => {
    const invalidSnapshot = {
      symbol: 'AAPL',
      quantity: 'ten',
      avgCost: 150.5,
      marketPrice: 175.2,
      marketValue: 1752.0,
      unrealizedPnl: 247.0,
      unrealizedPnlPct: 0.164,
      fetchedAt: new Date().toISOString()
    };
    const result = PositionSnapshotSchema.safeParse(invalidSnapshot);
    expect(result.success).toBe(false);
  });
});

describe('AlertSchema', () => {
  it('should validate a correct alert', () => {
    const validAlert = {
      level: 'INFO',
      symbol: 'AAPL',
      message: 'Price target reached'
    };
    const result = AlertSchema.safeParse(validAlert);
    expect(result.success).toBe(true);
  });

  it('should validate an alert without a symbol', () => {
    const validAlert = {
      level: 'CRITICAL',
      message: 'System error'
    };
    const result = AlertSchema.safeParse(validAlert);
    expect(result.success).toBe(true);
  });

  it('should reject an alert with an invalid level', () => {
    const invalidAlert = {
      level: 'INVALID',
      message: 'Test'
    };
    const result = AlertSchema.safeParse(invalidAlert);
    expect(result.success).toBe(false);
  });
});

describe('DataPointSchema', () => {
  it('should validate a correct data point', () => {
    const validDataPoint = {
      date: '2023-01-01',
      value: 100.5
    };
    const result = DataPointSchema.safeParse(validDataPoint);
    expect(result.success).toBe(true);
  });

  it('should reject a data point with invalid date', () => {
    const invalidDataPoint = {
      date: 123,
      value: 100.5
    };
    const result = DataPointSchema.safeParse(invalidDataPoint);
    expect(result.success).toBe(false);
  });
});

describe('MacroSnapshotSchema', () => {
  it('should validate a correct macro snapshot', () => {
    const validSnapshot = {
      'CPI': [
        { date: '2023-01-01', value: 100.5 },
        { date: '2023-02-01', value: 101.2 }
      ],
      'GDP': [
        { date: '2023-01-01', value: 25000 }
      ]
    };
    const result = MacroSnapshotSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
  });

  it('should reject a macro snapshot with wrong structure', () => {
    const invalidSnapshot = {
      'CPI': { date: '2023-01-01', value: 100.5 } // Should be an array
    };
    const result = MacroSnapshotSchema.safeParse(invalidSnapshot);
    expect(result.success).toBe(false);
  });
});

describe('RegimeQuadrantSchema', () => {
  it('should validate correct quadrants', () => {
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
      keyDrivers: ['Low inflation', 'Moderate growth'],
      transitionSignal: 'Possible uptick in CPI',
      evaluatedAt: new Date().toISOString()
    };
    const result = RegimeSnapshotSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
  });

  it('should validate without optional transitionSignal', () => {
    const validSnapshot = {
      quadrant: 'Stagflation',
      confidence: 70,
      keyDrivers: ['Rising prices', 'Stagnant growth'],
      evaluatedAt: new Date().toISOString()
    };
    const result = RegimeSnapshotSchema.safeParse(validSnapshot);
    expect(result.success).toBe(true);
  });

  it('should reject confidence out of bounds', () => {
    const invalidSnapshotLow = {
      quadrant: 'Goldilocks',
      confidence: -1,
      keyDrivers: ['Test'],
      evaluatedAt: new Date().toISOString()
    };
    const invalidSnapshotHigh = {
      quadrant: 'Goldilocks',
      confidence: 101,
      keyDrivers: ['Test'],
      evaluatedAt: new Date().toISOString()
    };
    expect(RegimeSnapshotSchema.safeParse(invalidSnapshotLow).success).toBe(false);
    expect(RegimeSnapshotSchema.safeParse(invalidSnapshotHigh).success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const invalidSnapshot = {
      quadrant: 'Goldilocks',
      confidence: 50,
      keyDrivers: ['Test'],
      evaluatedAt: 'not-a-date'
    };
    expect(RegimeSnapshotSchema.safeParse(invalidSnapshot).success).toBe(false);
  });
});
