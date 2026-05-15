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
    logRegimeEvaluation: vi.fn()
  }
}));

import { dbManager } from '../src/agents/db';
import { evaluateRegime } from '../src/agents/regimeAgent';

describe('regimeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // Default fs.readFileSync mock
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_system.txt')) return 'Mock Prompt with {{PORTFOLIO_CONTEXT}}';
        if (path.includes('regime_weights.json')) return JSON.stringify({});
        if (path.includes('regimeLatest.json')) return JSON.stringify({});
        if (path.includes('positions.json')) return JSON.stringify({});
      }
      return '';
    });
  });

  it('should define evaluateRegime function', () => {
    expect(evaluateRegime).toBeDefined();
  });

  it('should evaluate regime using generateAgentResponse', async () => {
    const mockMacroData = { inflation: 2.5, growth: 1.5 };
    
    const mockResponse = {
      regime_quadrant: 'Goldilocks',
      confidence: 85,
      inflation_score: 0.3,
      growth_score: 0.7,
      regime_drift_vs_prior: 'Stable',
      key_drivers: ['Driver 1', 'Driver 2'],
      confirming_indicators: ['Confirming 1'],
      contradicting_indicators: ['Contradicting 1'],
      central_thesis_conflict: 'No conflict',
      fastest_path_to_being_wrong: 'Growth slowing faster than expected',
      watch_next: ['Release 1'],
      transition_signal: 'None',
      assessed_at: new Date().toISOString()
    };

    mockGenerateAgentResponse.mockResolvedValue(mockResponse);

    const result = await evaluateRegime(mockMacroData);

    expect(result.regime_quadrant).toBe('Goldilocks');
    expect(result.confidence).toBe(85);
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'regimeAgent',
      systemPrompt: expect.stringContaining('Mock Prompt')
    }));
  });

  it('should persist to DB and cache to JSON', async () => {
    const mockMacroData = { inflation: 2.5, growth: 1.5 };
    
    const mockResponse = {
      regime_quadrant: 'Goldilocks',
      confidence: 85,
      inflation_score: 0.3,
      growth_score: 0.7,
      regime_drift_vs_prior: 'Stable',
      key_drivers: ['Driver 1'],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: 'None',
      fastest_path_to_being_wrong: 'None',
      watch_next: [],
      transition_signal: 'None',
      assessed_at: new Date().toISOString()
    };

    mockGenerateAgentResponse.mockResolvedValue(mockResponse);

    await evaluateRegime(mockMacroData);

    expect(dbManager.logRegimeEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      quadrant: 'Goldilocks',
      confidence: 85,
      data_inputs: mockMacroData
    }));
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('regimeLatest.json'),
      expect.stringContaining('"regime_quadrant": "Goldilocks"')
    );
  });

  it('should throw error if prompt file is missing', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('regime_system.txt')) return false;
        return true;
    });
    
    await expect(evaluateRegime({})).rejects.toThrow('System prompt file not found');
  });

  it('should inject portfolio context into system prompt', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_system.txt')) return 'PROMPT: {{PORTFOLIO_CONTEXT}}';
        if (path.includes('positions.json')) return JSON.stringify({
          'AAPL': {
            shares: 10,
            avg_cost: 150,
            position_type: 'equity_single',
            thesis: 'Good company',
            regime_match: ['Goldilocks'],
            thesis_invalidation: 'Bad earnings'
          }
        });
      }
      return JSON.stringify({});
    });

    mockGenerateAgentResponse.mockResolvedValue({
      regime_quadrant: 'Goldilocks',
      confidence: 90,
      assessed_at: new Date().toISOString(),
      key_drivers: []
    });

    await evaluateRegime({});

    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining('AAPL')
    }));
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.not.stringContaining('{{PORTFOLIO_CONTEXT}}')
    }));
  });
});
