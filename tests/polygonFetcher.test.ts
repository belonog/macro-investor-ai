import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  getEodPrices,
  getEarningsCalendar,
  fetchSeries,
  updateMacroCache,
} from '../src/data/fetchers/polygonFetcher.js';
import { RAW_POLYGON_SERIES_IDS } from '../src/data/indicators/registry.js';

vi.mock('axios');

const { mockGetCache, mockSetCache } = vi.hoisted(() => ({
  mockGetCache: vi.fn(),
  mockSetCache: vi.fn(),
}));

vi.mock('../src/db/database.js', () => ({
  db: {
    getCache: mockGetCache,
    setCache: mockSetCache,
  },
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    POLYGON_API_KEY: 'test_api_key',
    POLYGON_API_LIMIT: 5,
    POLYGON_API_WINDOW_MS: 1, // 1ms for tests to prevent hanging
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
  },
}));

describe('polygonFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCache.mockReturnValue(null);
  });

  // ── Existing tests (unchanged) ────────────────────────────────────────────

  it('fetches EOD prices', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { results: [{ c: 150.0 }] },
    });
    const prices = await getEodPrices(['AAPL', 'MSFT']);
    expect(prices).toEqual({ AAPL: 150.0, MSFT: 150.0 });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('fetches earnings calendar', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        results: [
          {
            ticker: 'AAPL',
            fiscal_period_end: '2026-06-30',
            eps_estimate: 1.5,
            fiscal_period: 'Q3',
            report_date: '2026-07-25',
            amc: true,
          },
        ],
      },
    });
    const calendar = await getEarningsCalendar(['AAPL'], 7);
    expect(calendar).toHaveLength(1);
    expect(calendar[0].symbol).toBe('AAPL');
    expect(calendar[0].eps_estimate).toBe(1.5);
  });

  // ── fetchSeries ───────────────────────────────────────────────────────────

  describe('fetchSeries', () => {
    it('parses Polygon /range response into DataPoint[]', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          results: [
            { t: 1715644800000, c: 2350.5 }, // 2024-05-14
            { t: 1715731200000, c: 2360.0 }, // 2024-05-15
          ],
        },
      });

      const points = await fetchSeries('C:XAUUSD', '2024-05-14');

      expect(points).toHaveLength(2);
      expect(points[0]).toEqual({ date: '2024-05-14', value: 2350.5 });
      expect(points[1]).toEqual({ date: '2024-05-15', value: 2360.0 });
    });

    it('calls the correct /range endpoint with from/to dates', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({ data: { results: [] } });
      const from = '2024-01-01';

      await fetchSeries('C:XAUUSD', from);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/v2/aggs/ticker/C:XAUUSD/range/1/day/2024-01-01/'),
        expect.objectContaining({
          params: expect.objectContaining({ apiKey: 'test_api_key', sort: 'asc' }),
        })
      );
    });

    it('returns empty array when results are absent', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });
      const points = await fetchSeries('C:XAUUSD');
      expect(points).toEqual([]);
    });

    it('skips bars with non-numeric fields', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: {
          results: [
            { t: 1715644800000, c: 2350.5 },
            { t: 'bad', c: 2360.0 }, // invalid — t is not a number
            { t: 1715731200000, c: null }, // invalid — c is not a number
          ],
        },
      });

      const points = await fetchSeries('C:XAUUSD');
      expect(points).toHaveLength(1);
      expect(points[0].value).toBe(2350.5);
    });
  });

  // ── updateMacroCache ──────────────────────────────────────────────────────

  describe('updateMacroCache', () => {
    it('RAW_POLYGON_SERIES_IDS contains C:XAUUSD', () => {
      expect(RAW_POLYGON_SERIES_IDS).toContain('C:XAUUSD');
    });

    it('writes fetched series to the macro_snapshot cache', async () => {
      vi.mocked(axios.get).mockResolvedValue({
        data: {
          results: [{ t: 1715644800000, c: 2350.5 }],
        },
      });

      const snapshot = await updateMacroCache();

      expect(mockSetCache).toHaveBeenCalledWith(
        'macro_snapshot',
        expect.objectContaining({
          data: expect.objectContaining({
            series: expect.objectContaining({
              'C:XAUUSD': expect.arrayContaining([
                expect.objectContaining({ value: 2350.5 }),
              ]),
            }),
          }),
        })
      );
      expect(snapshot.series['C:XAUUSD']).toHaveLength(1);
    });

    it('performs an incremental fetch starting from the last cached date', async () => {
      const existingCache = {
        fetched_at: new Date().toISOString(),
        data: {
          series: {
            'C:XAUUSD': [
              { date: '2024-05-01', value: 2300.0 },
              { date: '2024-05-02', value: 2310.0 },
            ],
          },
          fetched_at: { 'C:XAUUSD': new Date().toISOString() },
        },
      };
      mockGetCache.mockReturnValue(existingCache);
      vi.mocked(axios.get).mockResolvedValueOnce({ data: { results: [] } });

      await updateMacroCache();

      expect(axios.get).toHaveBeenCalledWith(
        // startDate should be the last cached date: 2024-05-02
        expect.stringContaining('/range/1/day/2024-05-02/'),
        expect.anything()
      );
    });

    it('merges new points with cached points, preserving existing data', async () => {
      const existingCache = {
        fetched_at: new Date().toISOString(),
        data: {
          series: {
            'C:XAUUSD': [{ date: '2024-05-01', value: 2300.0 }],
          },
          fetched_at: { 'C:XAUUSD': new Date().toISOString() },
        },
      };
      mockGetCache.mockReturnValue(existingCache);
      // API returns one new point
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: { results: [{ t: 1715299200000, c: 2320.0 }] }, // 2024-05-10
      });

      const snapshot = await updateMacroCache();

      // Both old and new points must be present, sorted
      expect(snapshot.series['C:XAUUSD'].length).toBeGreaterThanOrEqual(2);
      expect(snapshot.series['C:XAUUSD'][0].date).toBe('2024-05-01');
    });

    it('stores an empty array and continues on fetch error', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('network error'));

      const snapshot = await updateMacroCache();

      // Should not throw; series key present but empty
      expect(snapshot.series['C:XAUUSD']).toEqual([]);
      // Cache is still written (with the empty array)
      expect(mockSetCache).toHaveBeenCalledWith('macro_snapshot', expect.anything());
    });
  });

  // ── Rate Limiter (Token Bucket) ───────────────────────────────────────────

  describe('Rate Limiter (Token Bucket)', () => {
    it('allows bursts up to POLYGON_API_LIMIT and throttles subsequent requests', async () => {
      // Use the actual env object mock
      const originalLimit = (await import('../src/config/env.js')).env.POLYGON_API_LIMIT;
      const originalWindow = (await import('../src/config/env.js')).env.POLYGON_API_WINDOW_MS;
      
      const mockedEnv = (await import('../src/config/env.js')).env;
      mockedEnv.POLYGON_API_LIMIT = 2;
      mockedEnv.POLYGON_API_WINDOW_MS = 50; // 50ms window

      vi.mocked(axios.get).mockResolvedValue({
        data: { results: [{ c: 100.0 }] },
      });

      const start = Date.now();
      
      // Fire 3 requests concurrently
      // The first 2 should execute instantly, the 3rd should wait ~50ms
      const p1 = getEodPrices(['A']);
      const p2 = getEodPrices(['B']);
      const p3 = getEodPrices(['C']);
      
      await Promise.all([p1, p2, p3]);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(50);
      expect(axios.get).toHaveBeenCalledTimes(3);

      // Restore
      mockedEnv.POLYGON_API_LIMIT = originalLimit;
      mockedEnv.POLYGON_API_WINDOW_MS = originalWindow;
    });
  });
});
