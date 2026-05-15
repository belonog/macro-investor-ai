import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSeries, fetchAll, updateMacroCache, getLatestValues, TARGET_SERIES } from '../src/data/fetchers/fredFetcher.js';
import axios from 'axios';
import fs from 'fs/promises';
import { getManualIndicators } from '../src/utils/manualIndicators.js';

vi.mock('axios');
vi.mock('fs/promises');
vi.mock('../src/utils/manualIndicators.js');

describe('fredFetcher TARGET_SERIES', () => {
  it('contains WTI Crude and Henry Hub Natural Gas series IDs', () => {
    expect(TARGET_SERIES).toHaveProperty('DCOILWTICO');
    expect(TARGET_SERIES).toHaveProperty('DHHNGSP');
  });
});

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

    const result = await fetchSeries('CPIAUCSL', '2023-01-01');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: '2023-01-01', value: 100.5 });
  });

  it('should throw error if FRED_API_KEY is missing', async () => {
    const originalApiKey = process.env.FRED_API_KEY;
    delete process.env.FRED_API_KEY;
    
    await expect(fetchSeries('CPIAUCSL')).rejects.toThrow('FRED_API_KEY is not set');
    
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

      const result = await fetchAll();
      expect(Object.keys(result.series)).toEqual(expect.arrayContaining(Object.keys(TARGET_SERIES)));
      expect(result.series['CPIAUCSL']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
    });

    it('should handle failures for individual series', async () => {
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockImplementation((url: string, config: any) => {
        if (config.params.series_id === 'T10Y2Y') {
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
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await updateMacroCache();
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('macroSnapshot.json'),
        expect.stringContaining('"CPIAUCSL":')
      );
      expect(result.series['CPIAUCSL']).toEqual([{ date: '2023-01-01', value: 100.0 }]);
    });
  });

  describe('getLatestValues', () => {
    it('should return latest values and derived metrics from cache', async () => {
      const mockCache = {
        fetchedAt: new Date().toISOString(),
        data: {
          series: {
            'CPIAUCSL': Array(7).fill({ date: '2023-01-01', value: 3.0 }),
            'PAYEMS': [
              { date: '2023-01-01', value: 1000 },
              { date: '2023-01-02', value: 1000 },
              { date: '2023-01-03', value: 1000 },
              { date: '2023-01-04', value: 1000 },
              { date: '2023-02-01', value: 1100 },
              { date: '2023-03-01', value: 1250 },
              { date: '2023-04-01', value: 1450 }
            ],
            'DCOILWTICO': [
              { date: '2023-01-01', value: 100 },
              { date: '2023-01-02', value: 100 },
              { date: '2023-01-03', value: 100 },
              { date: '2023-01-04', value: 100 },
              { date: '2023-02-01', value: 105 },
              { date: '2023-03-01', value: 110 },
              { date: '2023-04-01', value: 120 }
            ],
            'ECIWAG': Array(7).fill({ date: '2023-01-01', value: 4.5 }),
            'DGS30': Array(7).fill({ date: '2023-01-01', value: 4.0 }),
            'DGS2': Array(7).fill({ date: '2023-01-01', value: 4.5 }),
            'BAMLH0A0HYM2': [
              { date: '2023-01-01', value: 4.0 },
              { date: '2023-01-02', value: 4.1 },
              { date: '2023-01-03', value: 4.2 },
              { date: '2023-01-04', value: 4.3 },
              { date: '2023-01-05', value: 4.4 },
              { date: '2023-01-06', value: 4.6 },
              { date: '2023-01-07', value: 4.6 }
            ],
            'PCEPI': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'PPIACO': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'T5YIE': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'T5YIFR': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'DFII5': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'GDPC1': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'RSAFS': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'RSXFS': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'INDPRO': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'CAPUTLG211S': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'BAMLC0A0CM': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'UMCSENT': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'PSAVERT': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'FEDFUNDS': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'DGS10': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'T10Y2Y': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'DTWEXBGS': Array(7).fill({ date: '2023-01-01', value: 0 }),
            'M2SL': Array(7).fill({ date: '2023-01-01', value: 0 })
          },
          fetchedAt: Object.keys(TARGET_SERIES).reduce((acc, k) => ({ ...acc, [k]: new Date().toISOString() }), {})
        }
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCache));
      vi.mocked(getManualIndicators).mockReturnValue({
        'MANUAL_TEST': { value: 99.9, period: '2023-05', updatedAt: new Date().toISOString(), source: 'test' }
      });

      const latest = await getLatestValues();
      
      // Basic values
      expect(latest['CPIAUCSL']).toBe(3.0);
      expect(latest['PAYEMS']).toBe(1450);
      
      // Derived: oil_price_3m_change ( (120 - 100) / 100 = 0.2 )
      expect(latest['oil_price_3m_change']).toBeCloseTo(0.2);
      
      // Derived: nfp_3m_avg ( (200 + 150 + 100) / 3 = 150 )
      expect(latest['nfp_3m_avg']).toBeCloseTo(150);
      
      // Derived: real_wages ( 4.5 - 3.0 = 1.5 )
      expect(latest['real_wages']).toBe(1.5);
      
      // Derived: yield_curve_30_2 ( 4.0 - 4.5 = -0.5 )
      expect(latest['yield_curve_30_2']).toBe(-0.5);
      
      // Derived: credit_spread_delta ( 4.6 - avg(4.1, 4.2, 4.3, 4.4, 4.6, 4.6) )
      // avg = 26.2 / 6 = 4.3666...
      // delta = 4.6 - 4.3666 = 0.2333...
      expect(latest['credit_spread_delta']).toBeCloseTo(0.2333, 4);

      // Manual indicator
      expect(latest['MANUAL_TEST']).toBe(99.9);
    });

    it('should fetch and update cache if cache is missing', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(getManualIndicators).mockReturnValue({});
      const mockedAxios = vi.mocked(axios);
      mockedAxios.get.mockResolvedValue({
        data: {
          observations: Array(12).fill({ date: '2023-01-01', value: '110.0' })
        }
      });

      const latest = await getLatestValues();
      expect(latest['CPIAUCSL']).toBe(110.0);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});