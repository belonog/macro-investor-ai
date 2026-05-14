import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSeries, fetchAll, updateMacroCache, getLatestValues, TARGET_SERIES } from '../src/data/fetchers/fredFetcher.js';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

vi.mock('axios');
vi.mock('fs/promises');

describe('fredFetcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.FRED_API_KEY = 'test_api_key';
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

    const result = await fetchSeries('INDPRO', 12);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: '2023-01-01', value: 100.5 });
  });

  it('should throw error if FRED_API_KEY is missing', async () => {
    const originalApiKey = process.env.FRED_API_KEY;
    delete process.env.FRED_API_KEY;
    
    await expect(fetchSeries('INDPRO')).rejects.toThrow('FRED_API_KEY is not set');
    
    process.env.FRED_API_KEY = originalApiKey;
  });

  describe('fetchAll', () => {
    it('should fetch all target series concurrently', async () => {
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockResolvedValue({
        data: {
          observations: [{ date: '2023-01-01', value: '100.0' }]
        }
      });

      const result = await fetchAll(1);
      expect(Object.keys(result)).toEqual(expect.arrayContaining(TARGET_SERIES));
      expect(result['INDPRO']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
    });

    it('should handle failures for individual series', async () => {
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockImplementation((url, config) => {
        if (config.params.series_id === 'T10Y2Y') {
          return Promise.reject(new Error('FRED failure'));
        }
        return Promise.resolve({
          data: {
            observations: [{ date: '2023-01-01', value: '100.0' }]
          }
        });
      });

      const result = await fetchAll(1);
      expect(result['T10Y2Y']).toEqual([]);
      expect(result['INDPRO']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
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

      const result = await updateMacroCache(1);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('macroSnapshot.json'),
        expect.stringContaining('"INDPRO":')
      );
      expect(result['INDPRO']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
    });
  });

  describe('getLatestValues', () => {
    it('should return latest values from cache if available', async () => {
      const mockCache = {
        fetchedAt: new Date().toISOString(),
        data: {
          'INDPRO': [{ date: '2023-01-01', value: 105.0 }],
          'PAYEMS': [{ date: '2023-01-01', value: 150000.0 }]
        }
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCache));

      const latest = await getLatestValues();
      expect(latest).toEqual({
        'INDPRO': 105.0,
        'PAYEMS': 150000.0
      });
    });

    it('should fetch and update cache if cache is missing', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockResolvedValue({
        data: {
          observations: [{ date: '2023-01-01', value: '110.0' }]
        }
      });

      const latest = await getLatestValues();
      expect(latest['INDPRO']).toBe(110.0);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
