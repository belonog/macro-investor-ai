import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

const { mockGenerateAgentResponse } = vi.hoisted(() => ({
  mockGenerateAgentResponse: vi.fn()
}));

vi.mock('../src/agents/baseAgent', () => ({
  generateAgentResponse: mockGenerateAgentResponse
}));

vi.mock('fs');
vi.mock('../src/agents/db', () => ({
  dbManager: {
    logRebalancingDecision: vi.fn()
  }
}));

import { dbManager } from '../src/agents/db';
import { generateRebalancingReport } from '../src/agents/rebalancingAgent';
import { StaleRegimeError } from '../src/utils/errors';

describe('rebalancingAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should define generateRebalancingReport function', () => {
    expect(generateRebalancingReport).toBeDefined();
  });

  it('should throw StaleRegimeError if regime data is older than 7 days', async () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 8);
    
    const mockRegime = {
      regime_quadrant: 'Goldilocks',
      confidence: 90,
      inflation_score: 0.2,
      growth_score: 0.8,
      regime_drift_vs_prior: 'Stable',
      key_drivers: ['Strong GDP'],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'Inflation spike',
      watch_next: [],
      assessed_at: staleDate.toISOString()
    };

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_latest.json')) return JSON.stringify(mockRegime);
        if (path.includes('rebalancing_system.txt')) return 'Mock Prompt';
        if (path.includes('positions.json')) return '{}';
      }
      return '{}';
    });

    await expect(generateRebalancingReport()).rejects.toThrow(StaleRegimeError);
  });

  it('should generate rebalancing report using generateAgentResponse', async () => {
    const mockRegime = {
      regime_quadrant: 'Goldilocks',
      confidence: 90,
      inflation_score: 0.2,
      growth_score: 0.8,
      regime_drift_vs_prior: 'Stable',
      key_drivers: ['Strong GDP'],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'Inflation spike',
      watch_next: [],
      assessed_at: new Date().toISOString()
    };
    
    const mockPositions = [
      {
        symbol: 'TLT',
        quantity: 100,
        avgCost: 90,
        marketPrice: 91,
        marketValue: 9100,
        unrealizedPnl: 100,
        unrealizedPnlPct: 1.1,
        fetchedAt: new Date().toISOString()
      }
    ];

    const mockConfig = {
      TLT: {
        shares: 100,
        avg_cost: 90,
        position_type: 'macro_core',
        thesis: 'Recession play',
        regime_match: ['Deflationary Recession'],
        thesis_invalidation: 'Yield spike'
      }
    };

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_latest.json')) return JSON.stringify(mockRegime);
        if (path.includes('positions_snapshot.json')) return JSON.stringify(mockPositions);
        if (path.includes('positions.json')) return JSON.stringify(mockConfig);
        if (path.includes('rebalancing_system.txt')) return 'Mock Prompt: {{PORTFOLIO_CONTEXT}}';
      }
      return '';
    });

    mockGenerateAgentResponse.mockResolvedValue({
      regime_portfolio_alignment_score: 0.65,
      alignment_grade: 'B',
      position_assessments: [
        {
          symbol: 'TLT',
          position_type: 'macro_core',
          regime_fit: 'Moderate',
          thesis_intact: true,
          suggested_action: 'Hold',
          action_rationale: 'Regime is Goldilocks, but TLT is a recession play. Hold for now.',
          urgency: 'None',
          conflict_flag: null
        }
      ],
      priority_actions: ['Hold TLT'],
      regime_transition_implication: 'None',
      thesis_conflict_resolution: 'None',
      rebalancing_rationale: 'Overall good alignment',
      fastest_path_to_being_wrong: 'Rate hikes',
      evaluated_at: new Date().toISOString()
    });

    const result = await generateRebalancingReport();

    expect(result.alignment_grade).toBe('B');
    expect(result.regime_portfolio_alignment_score).toBe(0.65);
    expect(result.position_assessments[0].symbol).toBe('TLT');
    expect(result.evaluated_at).toBeDefined();
    
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'rebalancingAgent',
      systemPrompt: expect.stringContaining('TLT — Deflationary Recession — Recession play')
    }));
    
    expect(dbManager.logRebalancingDecision).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('rebalancingLatest.json'),
      expect.stringContaining('"alignment_grade": "B"')
    );
  });
});

