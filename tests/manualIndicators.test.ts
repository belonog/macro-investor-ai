import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getManualIndicators, setManualIndicator } from '../src/utils/manualIndicators.js';
import fs from 'fs';

vi.mock('fs', () => {
  let mockFiles: Record<string, string> = {};
  const mockFs = {
    existsSync: vi.fn((path) => !!mockFiles[path]),
    readFileSync: vi.fn((path) => {
      if (mockFiles[path]) return mockFiles[path];
      throw new Error(`File not found: ${path}`);
    }),
    writeFileSync: vi.fn((path, data) => {
      mockFiles[path] = data.toString();
    }),
    mkdirSync: vi.fn(),
    __resetMockFiles: () => { mockFiles = {}; }
  };
  return {
    ...mockFs,
    default: mockFs
  };
});

describe('manualIndicators utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs as unknown as { __resetMockFiles: () => void }).__resetMockFiles();
  });

  it('should return an empty object if cache file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const indicators = getManualIndicators();
    expect(indicators).toEqual({});
  });

  it('should set and get a manual indicator', () => {
    const indicator = {
      value: 51.6,
      period: '2026-05',
      description: 'ISM Services PMI',
      updated_at: '2026-05-19T12:00:00.000Z',
      source: 'ismworld.org',
    };
    
    // Setup existsSync to return true once the file is written
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      try {
        fs.readFileSync(path);
        return true;
      } catch {
        return false;
      }
    });

    setManualIndicator('ism_services', indicator);
    
    const indicators = getManualIndicators();
    expect(indicators.ism_services).toEqual(indicator);
  });

  it('should handle multiple indicators', () => {
    const ind1 = { value: 51.6, period: '2026-05', description: 'ISM Services PMI', updated_at: '2026-05-19T12:00:00.000Z', source: 's1' };
    const ind2 = { value: 128.3, period: '2026-04', description: 'FAO Food Price Index', updated_at: '2026-05-19T12:00:00.000Z', source: 's2' };
    
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      try {
        fs.readFileSync(path);
        return true;
      } catch {
        return false;
      }
    });

    setManualIndicator('ism_services', ind1);
    setManualIndicator('fao_food_price_index', ind2);
    
    const indicators = getManualIndicators();
    expect(indicators.ism_services).toEqual(ind1);
    expect(indicators.fao_food_price_index).toEqual(ind2);
  });
});
