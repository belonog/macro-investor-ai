import { describe, it, expect } from 'vitest';
import { normalize, redistributeWeights } from '../src/agents/regimePipeline';

describe('regimePipeline - normalization', () => {
  const bounds = { low: 0, neutral: 2.0, high: 7.0 };

  it('normalizes values below neutral', () => {
    // 0 should map to 0
    expect(normalize(0, bounds)).toBe(0);
    // 1.0 should map to 0.25 (midpoint of 0 and 2.0)
    expect(normalize(1.0, bounds)).toBe(0.25);
    // 2.0 should map to 0.5
    expect(normalize(2.0, bounds)).toBe(0.5);
  });

  it('normalizes values above neutral', () => {
    // 4.5 should map to 0.75 (midpoint of 2.0 and 7.0)
    expect(normalize(4.5, bounds)).toBe(0.75);
    // 7.0 should map to 1.0
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
    const { effectiveWeights, gaps } = redistributeWeights(weights, indicators as any);
    expect(effectiveWeights).toEqual(weights);
    expect(gaps).toHaveLength(0);
  });

  it('redistributes weights when an indicator is missing', () => {
    const indicators = { a: 1, c: 3 }; // b is missing
    const { effectiveWeights, gaps } = redistributeWeights(weights, indicators as any);
    
    // Total available weight = 0.5 (a) + 0.2 (c) = 0.7
    // Effective a = 0.5 / 0.7 = 0.714...
    // Effective c = 0.2 / 0.7 = 0.285...
    expect(effectiveWeights.a).toBeCloseTo(0.5 / 0.7);
    expect(effectiveWeights.c).toBeCloseTo(0.2 / 0.7);
    expect(effectiveWeights.b).toBeUndefined();
    
    expect(gaps).toHaveLength(1);
    expect(gaps[0].indicator).toBe('b');
    expect(gaps[0].weightRedistributedTo).toEqual(['a', 'c']);
  });

  it('handles all indicators missing', () => {
    const indicators = {};
    const { effectiveWeights, gaps } = redistributeWeights(weights, indicators as any);
    expect(effectiveWeights).toEqual({});
    expect(gaps).toHaveLength(3);
  });
});
