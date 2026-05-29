import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkStopProximity, checkThesisThresholds, checkDeadlines } from '../src/monitor/eodMonitor.js';
import { PortfolioConfig, MacroIndicators, Alert } from '../src/types/index.js';

describe('eodMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should detect stop breaches and thesis crossings', () => {
    const mockConfig: PortfolioConfig = {
      TLT: {
        description: 'TLT',
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
        description: 'SPEC',
        shares: 10,
        avg_cost: 100,
        position_type: 'speculative',
        thesis: 'Bet',
        regime_match: ['Goldilocks'],
        deadline: '2026-05-15', // 1 day from "today" (May 14)
        thesis_invalidation: 'Time'
      }
    };

    const mockPrices: Record<string, number> = {
      'TLT': 84 // Below hard stop 85
    };

    const mockIndicators: MacroIndicators = {
      'yield_30y_pct': { value: 5.2, unit: '%', as_of: '2026-05-15', source: 'fred', description: '30Y Yield' }, // Above hard exit 5.1
      'yield_10y_pct': { value: 4.0, unit: '%', as_of: '2026-05-15', source: 'fred', description: '10Y Yield' }
    };

    const stopAlerts = checkStopProximity(mockPrices, mockConfig);
    const thesisAlerts = checkThesisThresholds(mockIndicators, mockConfig);
    const deadlineAlerts = checkDeadlines(mockConfig);

    const alerts: Alert[] = [...stopAlerts, ...thesisAlerts, ...deadlineAlerts];

    expect(alerts.some((a: Alert) => a.symbol === 'TLT' && a.message.includes('Hard stop breached'))).toBe(true);
    expect(alerts.some((a: Alert) => a.symbol === 'TLT' && a.message.includes('Thesis invalidation threshold breached'))).toBe(true);
    expect(alerts.some((a: Alert) => a.symbol === 'SPEC' && a.message.includes('Speculative deadline approaching'))).toBe(true);
    
    expect(alerts.length).toBe(3);
  });
});

