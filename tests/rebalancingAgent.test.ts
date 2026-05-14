import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn()
}));

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(function() {
      return {
        models: {
          generateContent: mockGenerateContent
        }
      };
    })
  };
});

vi.mock('fs');
vi.mock('../src/agents/db', () => ({
  dbManager: {
    logRebalancingDecision: vi.fn()
  }
}));

import { dbManager } from '../src/agents/db';
import { generateRebalancingReport } from '../src/agents/rebalancingAgent';

describe('rebalancingAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should define generateRebalancingReport function', () => {
    expect(generateRebalancingReport).toBeDefined();
  });

  it('should generate rebalancing report using Gemini API', async () => {
    const mockRegime = {
      quadrant: 'Goldilocks',
      confidence: 90,
      inflation_score: 0.2,
      growth_score: 0.8,
      regime_drift_vs_prior: 'Stable',
      keyDrivers: ['Strong GDP'],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'Inflation spike',
      watch_next: [],
      evaluatedAt: new Date().toISOString()
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
        if (path.includes('regimeLatest.json')) return JSON.stringify(mockRegime);
        if (path.includes('positionsSnapshot.json')) return JSON.stringify(mockPositions);
        if (path.includes('positions.json')) return JSON.stringify(mockConfig);
        if (path.includes('rebalancing_system.txt')) return 'Mock Prompt';
      }
      return '';
    });

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        alignment_score: 0.65,
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
        fastest_path_to_being_wrong: 'Rate hikes'
      })
    });

    const result = await generateRebalancingReport();

    expect(result.alignment_grade).toBe('B');
    expect(result.alignment_score).toBe(0.65);
    expect(result.position_assessments[0].symbol).toBe('TLT');
    expect(result.evaluatedAt).toBeDefined();
    
    expect(dbManager.logRebalancingDecision).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('rebalancingLatest.json'),
      expect.stringContaining('"alignment_grade": "B"')
    );
  });
});
