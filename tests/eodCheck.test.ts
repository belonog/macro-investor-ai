import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { runEodCheck } from '../src/flows/eodCheck.js';
import * as flexReportFetcher from '../src/data/fetchers/flexReportFetcher.js';
import * as fredFetcher from '../src/data/fetchers/fredFetcher.js';
import * as polygonFetcher from '../src/data/fetchers/polygonFetcher.js';
import * as telegramBot from '../src/alerts/telegramBot.js';

vi.mock('fs');
vi.mock('../src/data/fetchers/flexReportFetcher.js');
vi.mock('../src/data/fetchers/fredFetcher.js');
vi.mock('../src/data/fetchers/polygonFetcher.js');
vi.mock('../src/alerts/telegramBot.js');

describe('eodCheck flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.IBKR_FLEX_TOKEN = 'test-token';
    process.env.IBKR_FLEX_REPORT_ID = 'test-id';
  });

  it('should run the full EOD check flow successfully', async () => {
    const mockSnapshot = [
      {
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150,
        marketPrice: 140, // Below stop?
        marketValue: 1400,
        unrealizedPnl: -100,
        unrealizedPnlPct: -6.6,
        fetchedAt: new Date().toISOString()
      }
    ];

    const mockConfig = {
      AAPL: {
        shares: 10,
        avg_cost: 150,
        position_type: 'macro_core',
        thesis: 'Growth',
        regime_match: ['Goldilocks'],
        stop: 145,
        thesis_invalidation: 'Slowdown'
      }
    };

    vi.mocked(flexReportFetcher.fetchPortfolioSnapshot).mockResolvedValue(mockSnapshot);
    vi.mocked(fredFetcher.getLatestValues).mockResolvedValue({
      'DGS30': 4.5
    });
    vi.mocked(polygonFetcher.getEodPrices).mockResolvedValue({
      'AAPL': 140
    });
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

    await runEodCheck();

    // Verify snapshot was cached
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('positions_snapshot.json'),
      expect.stringContaining('AAPL')
    );

    // Verify config was updated/synced
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('positions.json'),
      expect.stringContaining('"shares": 10')
    );

    // Verify alerts were sent (at least for the stop proximity)
    expect(telegramBot.sendTelegramAlert).toHaveBeenCalled();
  });

  it('should send a CRITICAL alert if the flow fails', async () => {
    vi.mocked(flexReportFetcher.fetchPortfolioSnapshot).mockRejectedValue(new Error('IBKR Down'));

    await expect(runEodCheck()).rejects.toThrow('IBKR Down');

    expect(telegramBot.sendTelegramAlert).toHaveBeenCalledWith(expect.objectContaining({
      level: 'CRITICAL',
      message: expect.stringContaining('EOD Check Failed: IBKR Down')
    }));
  });
});
