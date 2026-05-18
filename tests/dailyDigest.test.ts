import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { runDailyDigest } from '../src/flows/dailyDigest.js';
import { runRegimeCycle } from '../src/flows/regimeCycle.js';
import { getEarningsCalendar } from '../src/data/fetchers/polygonFetcher.js';
import { getLatestValues } from '../src/data/fetchers/fredFetcher.js';
import { sendTelegramAlert } from '../src/alerts/telegramBot.js';

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_pipeline.json')) {
          return JSON.stringify({
            inflation_weights: { "cpi": 1.0 },
            growth_weights: { "gdp": 1.0 },
            inflation_bounds: { "cpi": { low: 0, neutral: 2, high: 4 } },
            growth_bounds: { "gdp": { low: 0, neutral: 2, high: 4 } },
            regime_thresholds: {
              inflation_high: 0.6,
              inflation_low: 0.4,
              growth_high: 0.55,
              growth_low: 0.45,
              boundary_zone: 0.05
            },
            staleness_limits_days: { monthly: 30, quarterly: 90, daily: 1, weekly: 7 }
          });
        }
      }
      return '{}';
    }),
    existsSync: vi.fn(() => true),
  },
  readFileSync: vi.fn((path) => {
    if (typeof path === 'string') {
      if (path.includes('regime_pipeline.json')) {
        return JSON.stringify({
          inflation_weights: { "cpi": 1.0 },
          growth_weights: { "gdp": 1.0 },
          inflation_bounds: { "cpi": { low: 0, neutral: 2, high: 4 } },
          growth_bounds: { "gdp": { low: 0, neutral: 2, high: 4 } },
          regime_thresholds: {
            inflation_high: 0.6,
            inflation_low: 0.4,
            growth_high: 0.55,
            growth_low: 0.45,
            boundary_zone: 0.05
          },
          staleness_limits_days: { monthly: 30, quarterly: 90, daily: 1, weekly: 7 }
        });
      }
    }
    return '{}';
  }),
  existsSync: vi.fn(() => true),
}));
vi.mock('../src/flows/regimeCycle.js');
vi.mock('../src/data/fetchers/polygonFetcher.js');
vi.mock('../src/data/fetchers/fredFetcher.js');
vi.mock('../src/alerts/telegramBot.js');

describe('dailyDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should trigger regime cycle if regime assessment is missing or stale', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      if (typeof path === 'string' && path.includes('regime_latest.json')) return false;
      return true;
    });

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_pipeline.json')) {
          return JSON.stringify({
            inflation_weights: { "cpi": 1.0 },
            growth_weights: { "gdp": 1.0 },
            inflation_bounds: { "cpi": { low: 0, neutral: 2, high: 4 } },
            growth_bounds: { "gdp": { low: 0, neutral: 2, high: 4 } },
            regime_thresholds: {
              inflation_high: 0.6,
              inflation_low: 0.4,
              growth_high: 0.55,
              growth_low: 0.45,
              boundary_zone: 0.05
            },
            staleness_limits_days: { monthly: 30, quarterly: 90, daily: 1, weekly: 7 }
          });
        }
        if (path.includes('positions.json')) return JSON.stringify({ AAPL: {} });
        if (path.includes('regime_latest.json')) {
          return JSON.stringify({
            regimeQuadrant: 'Goldilocks',
            finalConfidence: 80,
            assessedAt: new Date().toISOString()
          });
        }
      }
      return '{}';
    });

    vi.mocked(getEarningsCalendar).mockResolvedValue([]);
    vi.mocked(getLatestValues).mockResolvedValue({});

    await runDailyDigest();

    expect(runRegimeCycle).toHaveBeenCalledWith('scheduled');
  });

  it('should format and send a digest correctly', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string' && path.includes('regime_latest.json')) {
        return JSON.stringify({
          regimeQuadrant: 'Stagflation',
          finalConfidence: 75,
          assessedAt: new Date().toISOString()
        });
      }
      if (typeof path === 'string' && path.includes('positions.json')) {
        return JSON.stringify({
          AAPL: { 
            shares: 10,
            avg_cost: 150,
            position_type: 'equity_single',
            thesis: 'Good company',
            regime_match: ['Goldilocks'],
            thesis_invalidation: 'Bad earnings'
          }
        });
      }
      return '{}';
    });

    vi.mocked(getEarningsCalendar).mockResolvedValue([
      { symbol: 'AAPL', reportDate: '2026-05-19', epsEstimate: 1.5, timeOfDay: 'post' }
    ]);
    
    vi.mocked(getLatestValues).mockResolvedValue({
      DGS30: 4.5,
      T5YIE: 2.3,
      nfp_3m_avg_k: 150
    });

    await runDailyDigest();

    expect(sendTelegramAlert).toHaveBeenCalledWith(expect.objectContaining({
      level: 'INFO',
      message: expect.stringContaining('*Current Regime:* Stagflation')
    }));
    
    // Check that indicators and earnings are in the message
    const callArgs = vi.mocked(sendTelegramAlert).mock.calls[0][0];
    expect(callArgs.message).toContain('30Y Yield: 4.50%');
    expect(callArgs.message).toContain('AAPL: 2026-05-19 (post)');
  });
});
