import { describe, it, expect } from 'vitest';
import { getRevisionLookbackPeriods } from '../src/data/indicators/registry.js';

describe('registry', () => {
  describe('getRevisionLookbackPeriods', () => {
    it('returns maximum lookback period for a given raw series ID', () => {
      // Assuming CPIAUCSL has a lookback (usually 1 for cpi_index)
      expect(getRevisionLookbackPeriods('CPIAUCSL')).toBeGreaterThanOrEqual(1);
      
      // If a series doesn't exist, it should return 0
      expect(getRevisionLookbackPeriods('NON_EXISTENT')).toBe(0);
    });
  });
});
