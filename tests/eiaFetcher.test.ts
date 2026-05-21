import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchSeries, fetchAll, updateMacroCache } from '../src/data/fetchers/eiaFetcher.js';
import { db } from '../src/db/database.js';

vi.mock('axios');
vi.mock('../src/db/database.js', () => ({
  db: {
    getCache: vi.fn(),
    setCache: vi.fn(),
  }
}));

describe('eiaFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSeries', () => {
    it('returns empty if no ids provided', async () => {
      const result = await fetchSeries([]);
      expect(result).toEqual({});
    });

    it('fetches EIA series and converts to DataPoint[]', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: { response: { data: [{ period: '2026-05-01', value: 1500 }] } }
      });
      const result = await fetchSeries(['/petroleum/sum/sndw/data/']);
      
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('api.eia.gov/v2/petroleum/sum/sndw/data/'), expect.any(Object));
      expect(result['/petroleum/sum/sndw/data/']).toHaveLength(1);
      expect(result['/petroleum/sum/sndw/data/'][0].value).toBe(1500);
      expect(result['/petroleum/sum/sndw/data/'][0].date).toBe('2026-05-01');
    });

    it('handles errors gracefully per series', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network Error'));
      const result = await fetchSeries(['/petroleum/sum/sndw/data/']);
      expect(result['/petroleum/sum/sndw/data/']).toEqual([]);
    });
  });

  describe('fetchAll', () => {
    it('returns snapshot structure', async () => {
      const snapshot = await fetchAll();
      expect(snapshot.series).toBeDefined();
      expect(snapshot.fetched_at).toBeDefined();
    });
  });

  describe('updateMacroCache', () => {
    it('updates cache and returns snapshot', async () => {
      vi.mocked(db.getCache).mockReturnValueOnce(null);
      const snapshot = await updateMacroCache();
      expect(snapshot.series).toBeDefined();
      expect(db.setCache).toHaveBeenCalled();
    });
  });
});
