import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { runEventPrebrief } from '../src/flows/eventPrebrief.js';
import * as polygonFetcher from '../src/data/fetchers/polygonFetcher.js';
import * as interpreterAgent from '../src/agents/interpreterAgent.js';
import * as telegramBot from '../src/alerts/telegramBot.js';

vi.mock('fs');
vi.mock('../src/data/fetchers/polygonFetcher.js');
vi.mock('../src/agents/interpreterAgent.js');
vi.mock('../src/alerts/telegramBot.js');

describe('eventPrebrief flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run the full event pre-brief flow successfully', async () => {
    const mockConfig = {
      AAPL: {
        shares: 10,
        avg_cost: 150,
        position_type: 'equity_single',
        thesis: 'Growth thesis',
        regime_match: ['Goldilocks'],
        thesis_invalidation: 'Slowdown'
      }
    };

    const mockEvents = [
      {
        symbol: 'AAPL',
        reportDate: '2026-05-20',
        epsEstimate: 1.5,
        timeOfDay: 'post'
      }
    ];

    const mockPrebrief = {
      key_metrics_to_watch: ['iPhone sales', 'Services growth'],
      thesis_impact: 'Critical for growth validation',
      risk_factors: ['Supply chain issues'],
      summary_markdown: 'AAPL earnings coming up. Watch iPhone sales.'
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));
    vi.mocked(polygonFetcher.getEarningsCalendar).mockResolvedValue(mockEvents as any);
    vi.mocked(interpreterAgent.generatePrebrief).mockResolvedValue(mockPrebrief);

    await runEventPrebrief();

    expect(polygonFetcher.getEarningsCalendar).toHaveBeenCalledWith(['AAPL'], 2);
    expect(interpreterAgent.generatePrebrief).toHaveBeenCalledWith('AAPL', 'Growth thesis', mockEvents[0], mockConfig);
    expect(telegramBot.sendTelegramAlert).toHaveBeenCalledWith(expect.objectContaining({
      level: 'WARNING',
      symbol: 'AAPL',
      message: expect.stringContaining('AAPL Earnings')
    }));
  });

  it('should skip if no events found', async () => {
    const mockConfig = {
      AAPL: {
        shares: 10,
        avg_cost: 150,
        position_type: 'equity_single' as const,
        thesis: 'Growth thesis',
        regime_match: ['Goldilocks' as const],
        thesis_invalidation: 'Slowdown'
      }
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));
    vi.mocked(polygonFetcher.getEarningsCalendar).mockResolvedValue([]);

    await runEventPrebrief();

    expect(interpreterAgent.generatePrebrief).not.toHaveBeenCalled();
    expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
  });
});
