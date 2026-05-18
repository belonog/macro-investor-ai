import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getManualIndicators, setManualIndicator } from '../src/utils/manualIndicators.js';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'src/data/cache');
const CACHE_FILE = path.join(CACHE_DIR, 'manual_indicators.json');

describe('manualIndicators utility', () => {
  beforeEach(() => {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  });

  it('should return an empty object if cache file does not exist', () => {
    const indicators = getManualIndicators();
    expect(indicators).toEqual({});
  });

  it('should set and get a manual indicator', () => {
    const indicator = {
      value: 51.6,
      period: '2026-05',
      updatedAt: new Date().toISOString(),
      source: 'ismworld.org',
    };
    setManualIndicator('ism_services', indicator);
    
    const indicators = getManualIndicators();
    expect(indicators.ism_services).toEqual(indicator);
  });

  it('should handle multiple indicators', () => {
    const ind1 = { value: 51.6, period: '2026-05', updatedAt: new Date().toISOString(), source: 's1' };
    const ind2 = { value: 128.3, period: '2026-04', updatedAt: new Date().toISOString(), source: 's2' };
    
    setManualIndicator('ism_services', ind1);
    setManualIndicator('fao_food_price_index', ind2);
    
    const indicators = getManualIndicators();
    expect(indicators.ism_services).toEqual(ind1);
    expect(indicators.fao_food_price_index).toEqual(ind2);
  });
});
