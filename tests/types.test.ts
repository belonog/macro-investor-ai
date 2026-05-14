import { describe, it, expect } from 'vitest';
import { PositionSnapshotSchema, AlertSchema } from '../src/data/types.js';

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
