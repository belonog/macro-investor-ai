import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { runEodMonitor } from '../src/monitor/eodMonitor.js';

vi.mock('fs');
vi.mock('../src/data/macroSnapshot', () => ({
  getLatestValues: vi.fn().mockResolvedValue({
    'yield_30y_pct': { value: 5.2, unit: '%', as_of: '2026-05-15', source: 'fred', description: '30Y Yield' }, // Above hard exit 5.1
    'yield_10y_pct': { value: 4.0, unit: '%', as_of: '2026-05-15', source: 'fred', description: '10Y Yield' }
  })
}));

describe('eodMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should detect stop breaches and thesis crossings', async () => {
    const mockConfig = {
      TLT: {
        shares: 100,
        avg_cost: 90,
        position_type: 'macro_core',
        thesis: 'Recession',
        regime_match: ['Deflationary Recession'],
        stop: 88,
        hard_stop: 85,
        thesis_invalidation: 'Yield spike',
        threshold_monitor: {
          indicator: 'yield_30y',
          warn_at: 4.5,
          hard_exit_at: 5.1
        }
      },
      SPEC: {
        shares: 10,
        avg_cost: 100,
        position_type: 'speculative',
        thesis: 'Bet',
        regime_match: ['Goldilocks'],
        deadline: '2026-05-15', // 1 day from "today" (May 14)
        thesis_invalidation: 'Time'
      }
    };

    const mockSnapshots = [
      {
        symbol: 'TLT',
        market_price: 84, // Below hard stop 85
        market_value: 8400,
        quantity: 100,
        avg_cost: 90,
        unrealized_pnl: -600,
        unrealized_pnl_pct: -6.6,
        fetched_at: new Date().toISOString()
      }
    ];

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('positions.json')) return JSON.stringify(mockConfig);
        if (path.includes('positions_snapshot.json')) return JSON.stringify(mockSnapshots);
      }
      return '';
    });

    const alerts = await runEodMonitor();

    // 1. TLT Hard Stop Breach (84 <= 85)
    // 2. TLT Thesis Invalidation (5.2 >= 5.1)
    // 3. SPEC Deadline approaching (diff <= 5 days)

    expect(alerts.some(a => a.symbol === 'TLT' && a.message.includes('Hard stop breached'))).toBe(true);
    expect(alerts.some(a => a.symbol === 'TLT' && a.message.includes('Thesis invalidation threshold breached'))).toBe(true);
    expect(alerts.some(a => a.symbol === 'SPEC' && a.message.includes('Speculative deadline approaching'))).toBe(true);
    
    expect(alerts.length).toBe(3);
  });
});
