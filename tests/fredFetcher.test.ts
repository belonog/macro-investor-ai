import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSeries, fetchAll, updateMacroCache } from '../src/data/fetchers/fredFetcher.js';
import { RAW_FRED_SERIES_IDS } from '../src/data/indicators/registry.js';
import axios from 'axios';

import { env } from '../src/config/env.js';


vi.mock('../src/config/env.js', () => ({
  env: {
    FRED_API_KEY: 'test_api_key',
    NODE_ENV: 'test',
    LOG_LEVEL: 'info'
  }
}));

vi.mock('axios');

const { mockGetCache, mockSetCache } = vi.hoisted(() => ({
  mockGetCache: vi.fn(),
  mockSetCache: vi.fn()
}));

vi.mock('../src/db/database.js', () => ({
  db: {
    getCache: mockGetCache,
    setCache: mockSetCache
  }
}));

describe('fredFetcher registry RAW_FRED_SERIES_IDS', () => {
  it('contains WTI Crude and Henry Hub Natural Gas series IDs', () => {
    expect(RAW_FRED_SERIES_IDS).toContain('DCOILWTICO');
    expect(RAW_FRED_SERIES_IDS).toContain('DHHNGSP');
  });
});

describe('fredFetcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    env.FRED_API_KEY = 'test_api_key';
    mockGetCache.mockReturnValue(null);
  });

  it('should fetch and parse a FRED series', async () => {
    const mockedAxios = vi.mocked(axios);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        observations: [
          { date: '2023-01-01', value: '100.5' },
          { date: '2023-02-01', value: '.' } // Test handling of missing data
        ]
      }
    });

    const result = await fetchSeries('CPIAUCSL', '2023-01-01');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: '2023-01-01', value: 100.5 });
  });

  it('should throw error if FRED_API_KEY is missing', async () => {
    const originalApiKey = env.FRED_API_KEY;
    env.FRED_API_KEY = '';
    
    await expect(fetchSeries('CPIAUCSL')).rejects.toThrow('FRED_API_KEY is not set');
    
    env.FRED_API_KEY = originalApiKey;
  });

  describe('fetchAll', () => {
    it('should fetch all target series concurrently', async () => {
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockResolvedValue({
        data: {
          observations: [{ date: '2023-01-01', value: '100.0' }]
        }
      });

      const result = await fetchAll();
      expect(Object.keys(result.series)).toEqual(expect.arrayContaining(RAW_FRED_SERIES_IDS));
      expect(result.series['CPIAUCSL']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
    });

    it('should handle failures for individual series', async () => {
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockImplementation((_url: string, config?: { params?: { series_id?: string } }) => {
        if (config?.params?.series_id === 'T10Y2Y') {
          return Promise.reject(new Error('FRED failure'));
        }
        return Promise.resolve({
          data: {
            observations: [{ date: '2023-01-01', value: '100.0' }]
          }
        });
      });

      const result = await fetchAll();
      expect(result.series['T10Y2Y']).toEqual([]);
      expect(result.series['CPIAUCSL']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
    });
  });

  describe('updateMacroCache', () => {
    it('should fetch all and write to cache', async () => {
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockResolvedValue({
        data: {
          observations: [{ date: '2023-01-01', value: '100.0' }]
        }
      });
      mockGetCache.mockReturnValue(null);

      const result = await updateMacroCache();
      expect(mockSetCache).toHaveBeenCalledWith(
        'macro_snapshot',
        expect.objectContaining({ data: expect.objectContaining({ series: expect.objectContaining({ 'CPIAUCSL': expect.any(Array) }) }) })
      );
      expect(result.series['CPIAUCSL']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
    });

    it('should calculate startDate using revision_lookback_periods', async () => {
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockResolvedValue({
        data: { observations: [] }
      });
      
      const mockCache = {
        fetched_at: new Date().toISOString(),
        data: {
          series: {
            'CPIAUCSL': [
              { date: '2023-01-01', value: 100.0 },
              { date: '2023-02-01', value: 101.0 },
              { date: '2023-03-01', value: 102.0 }
            ]
          },
          fetched_at: {}
        }
      };
      mockGetCache.mockReturnValue(mockCache);

      // CPIAUCSL has a lookback of 1. Length is 3. index = Math.max(0, 3 - 1 - 1) = 1.
      // startDate should be '2023-02-01'.
      await updateMacroCache();
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/series/observations'),
        expect.objectContaining({
          params: expect.objectContaining({
            series_id: 'CPIAUCSL',
            observation_start: '2023-02-01'
          })
        })
      );
    });
  });
});

