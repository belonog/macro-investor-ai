import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchSeries, fetchAll, updateMacroCache } from '../src/data/fetchers/blsFetcher.js';
import { db } from '../src/db/database.js';

vi.mock('axios');
vi.mock('../src/db/database.js', () => ({
  db: {
    getCache: vi.fn(),
    setCache: vi.fn(),
  }
}));

describe('blsFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSeries', () => {
    it('returns empty object if no ids provided', async () => {
      const res = await fetchSeries([], '2026', '2026');
      expect(res).toEqual({});
    });

    it('fetches BLS series successfully via POST and converts to DataPoint[]', async () => {
      const mockResponse = {
        data: {
          status: 'REQUEST_SUCCEEDED',
          Results: {
            series: [
              {
                seriesID: 'CES0000000001',
                data: [
                  { year: '2026', period: 'M04', value: '150', periodName: 'April' }
                ]
              }
            ]
          }
        }
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const result = await fetchSeries(['CES0000000001'], '2026', '2026');

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.bls.gov/publicAPI/v2/timeseries/data/',
        expect.objectContaining({
          seriesid: ['CES0000000001'],
          startyear: '2026',
          endyear: '2026'
        })
      );
      
      expect(result['CES0000000001']).toHaveLength(1);
      expect(result['CES0000000001'][0].date).toBe('2026-04-01');
      expect(result['CES0000000001'][0].value).toBe(150);
    });

    it('throws error if BLS API returns failure status', async () => {
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: {
          status: 'REQUEST_FAILED',
          message: ['Invalid API key']
        }
      });

      await expect(fetchSeries(['CES0000000001'], '2026', '2026')).rejects.toThrow('BLS API Error: REQUEST_FAILED');
    });
  });

  describe('fetchAll', () => {
    it('returns snapshot structure even if empty', async () => {
      const snapshot = await fetchAll();
      expect(snapshot.series).toBeDefined();
      expect(snapshot.fetched_at).toBeDefined();
    });
  });

  describe('updateMacroCache', () => {
    it('returns snapshot without setting cache if no series to fetch', async () => {
      vi.mocked(db.getCache).mockReturnValueOnce(null);
      const snapshot = await updateMacroCache();
      expect(snapshot.series).toBeDefined();
    });
  });
});
