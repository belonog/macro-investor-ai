import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { runEodCheck } from '../src/flows/eodCheck.js';
import * as flexReportFetcher from '../src/data/fetchers/flexReportFetcher.js';
import * as macroSnapshot from '../src/data/macroSnapshot.js';
import * as polygonFetcher from '../src/data/fetchers/polygonFetcher.js';
import * as telegramBot from '../src/alerts/telegramBot.js';
import { env } from '../src/config/env.js';

vi.mock('../src/config/env.js', () => ({
  env: {
    IBKR_FLEX_TOKEN: 'test-token',
    IBKR_FLEX_REPORT_ID: 'test-id',
    NODE_ENV: 'test',
    LOG_LEVEL: 'info'
  }
}));

vi.mock('fs');
vi.mock('../src/data/fetchers/flexReportFetcher.js');
vi.mock('../src/data/macroSnapshot.js');
vi.mock('../src/data/fetchers/polygonFetcher.js');
vi.mock('../src/alerts/telegramBot.js');

const { mockSetCache } = vi.hoisted(() => ({
  mockSetCache: vi.fn()
}));

vi.mock('../src/db/database.js', () => ({
  db: {
    setCache: mockSetCache
  }
}));

describe('eodCheck flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.IBKR_FLEX_TOKEN = 'test-token';
    env.IBKR_FLEX_REPORT_ID = 'test-id';
  });

  it('should run the full EOD check flow successfully', async () => {
    const mockSnapshot = [
      {
        symbol: 'AAPL',
        quantity: 10,
        avg_cost: 150,
        market_price: 140, // Below stop?
        market_value: 1400,
        unrealized_pnl: -100,
        unrealized_pnl_pct: -6.6,
        fetched_at: new Date().toISOString()
      }
    ];

    const mockConfig = {
      AAPL: {
        description: 'Apple stock',
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
    vi.mocked(macroSnapshot.getLatestValues).mockResolvedValue({
      'DGS30': { value: 4.5, unit: '%', description: '30Y Yield', as_of: '2026-05-15', source: 'fred' }
    });
    vi.mocked(polygonFetcher.getEodPrices).mockResolvedValue({
      'AAPL': 140
    });
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

    await runEodCheck();

    // Verify snapshot was cached
    expect(mockSetCache).toHaveBeenCalledWith('positions_snapshot', expect.arrayContaining([
      expect.objectContaining({ symbol: 'AAPL' })
    ]));

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
