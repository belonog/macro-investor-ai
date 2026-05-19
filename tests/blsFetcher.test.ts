import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchSeries, getLatestReleases } from '../src/data/fetchers/blsFetcher.js';

vi.mock('axios');

describe('blsFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSeries', () => {
    it('fetches BLS series successfully via POST', async () => {
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

      const result = await fetchSeries(['CES0000000001'], '2026', '2026') as { seriesID: string, data: { value: string }[] }[];

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.bls.gov/publicAPI/v2/timeseries/data/',
        expect.objectContaining({
          seriesid: ['CES0000000001'],
          startyear: '2026',
          endyear: '2026'
        })
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].seriesID).toBe('CES0000000001');
      expect(result[0].data[0].value).toBe('150');
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

  describe('getLatestReleases', () => {
    it('returns formatted latest releases info', async () => {
      vi.mocked(axios.post).mockResolvedValueOnce({
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
      });
      const releases = await getLatestReleases();
      expect(releases).toBeInstanceOf(Array);
      expect(releases).toHaveLength(1);
      expect(releases[0]).toContain('CES0000000001');
      expect(releases[0]).toContain('150');
    });
  });
});
