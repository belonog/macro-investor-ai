import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { runCoherenceAgent, CoherenceInput } from '../src/agents/coherenceAgent.js';

const { mockGenerateAgentResponse } = vi.hoisted(() => ({
  mockGenerateAgentResponse: vi.fn()
}));

vi.mock('../src/agents/baseAgent', () => ({
  generateAgentResponse: mockGenerateAgentResponse
}));

vi.mock('fs');

describe('coherenceAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate coherence output using generateAgentResponse', async () => {
    const input: CoherenceInput = {
      symbol: 'BTC',
      thesis: 'Digital gold, inflation hedge',
      proposedSizeUsd: 5000,
      currentBook: {
        'TLT': {
          shares: 100,
          avg_cost: 90,
          position_type: 'macro_core',
          thesis: 'Recession hedge',
          regime_match: ['Deflationary Recession'],
          thesis_invalidation: 'Growth surprise'
        }
      },
      currentRegime: {
        regime_quadrant: 'Goldilocks',
        confidence: 85,
        inflation_score: 0.2,
        growth_score: 0.7,
        regime_drift_vs_prior: 'Stable',
        key_drivers: ['Steady growth'],
        confirming_indicators: [],
        contradicting_indicators: [],
        central_thesis_conflict: 'None',
        fastest_path_to_being_wrong: 'Inflation spike',
        watch_next: [],
        assessed_at: new Date().toISOString()
      }
    };

    vi.mocked(fs.readFileSync).mockReturnValue('Mock Prompt: {{PORTFOLIO_CONTEXT}}');

    const mockResponse = {
      regime_match: 'Strong',
      correlation_risk: 'Low correlation with current book',
      thesis_conflicts: [],
      sizing_note: 'Reasonable for a starter position',
      verdict: 'Proceed',
      questions_before_entry: [
        'What is your exit plan if inflation drops?',
        'How does this impact your total risk budget?',
        'Is the current volatility within your tolerance?'
      ]
    };

    mockGenerateAgentResponse.mockResolvedValue(mockResponse);

    const result = await runCoherenceAgent(input);

    expect(result).toEqual(mockResponse);
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'CoherenceAgent',
      systemPrompt: expect.stringContaining('TLT — Deflationary Recession — Recession hedge'),
      prompt: expect.stringContaining('Symbol: BTC'),
      trigger: 'manual'
    }));
  });
});
