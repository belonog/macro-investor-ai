import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getEodPrices, getEarningsCalendar, getGoldSpotPrice } from '../src/data/fetchers/polygonFetcher.js';

vi.mock('axios');

describe('polygonFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches EOD prices', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { results: [{ c: 150.0 }] }
    });
    const prices = await getEodPrices(['AAPL', 'MSFT']);
    expect(prices).toEqual({ AAPL: 150.0, MSFT: 150.0 });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('fetches earnings calendar', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { results: [{ ticker: 'AAPL', fiscal_period_end: '2026-06-30', eps_estimate: 1.5, fiscal_period: 'Q3', report_date: '2026-07-25', amc: true }] }
    });
    const calendar = await getEarningsCalendar(['AAPL'], 7);
    expect(calendar).toHaveLength(1);
    expect(calendar[0].symbol).toBe('AAPL');
    expect(calendar[0].eps_estimate).toBe(1.5);
  });

  it('fetches gold spot price', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { results: [{ c: 2350.5, t: 1715644800000 }] }
    });
    const indicator = await getGoldSpotPrice();
    expect(indicator.value).toBe(2350.5);
    expect(indicator.unit).toBe('USD per troy oz');
    expect(indicator.description).toBe('Gold Spot Price (XAU/USD)');
    expect(indicator.as_of).toBe('2024-05-14');
  });
});
