import { describe, it, expect, vi } from 'vitest';
import { fetchSeries } from '../src/data/fetchers/fredFetcher.js';
import axios from 'axios';

vi.mock('axios');

describe('fredFetcher', () => {
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

    // Mock environment variable
    process.env.FRED_API_KEY = 'test_api_key';

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
});
