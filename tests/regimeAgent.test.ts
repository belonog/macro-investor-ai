import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

// Hoist mocks to ensure they are available before imports
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
        if (path.includes('regime_system.txt')) return 'Mock Prompt with {{PORTFOLIO_CONTEXT}}';
        if (path.includes('regime_latest.json')) return JSON.stringify({});
        if (path.includes('positions.json')) return JSON.stringify({});
      }
      return '';
    }),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    promises: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn()
    }
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
        if (path.includes('regime_system.txt')) return 'Mock Prompt with {{PORTFOLIO_CONTEXT}}';
        if (path.includes('regime_latest.json')) return JSON.stringify({});
        if (path.includes('positions.json')) return JSON.stringify({});
      }
      return '';
  }),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const { mockGenerateAgentResponse } = vi.hoisted(() => ({
  mockGenerateAgentResponse: vi.fn()
}));

vi.mock('../src/agents/baseAgent', () => ({
  generateAgentResponse: mockGenerateAgentResponse
}));

vi.mock('../src/db/database', () => ({
  logRegimeEvaluation: vi.fn()
}));

import { logRegimeEvaluation } from '../src/db/database.js';
import { runRegimeAgent, evaluateRegime } from '../src/agents/regimeAgent.js';

describe('regimeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // Default fs.readFileSync mock
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_system.txt')) return 'Mock Prompt with {{PORTFOLIO_CONTEXT}}';
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
        if (path.includes('regime_latest.json')) return JSON.stringify({});
        if (path.includes('positions.json')) return JSON.stringify({});
      }
      return '';
    });
  });

  it('should define runRegimeAgent function', () => {
    expect(runRegimeAgent).toBeDefined();
    expect(evaluateRegime).toBeDefined(); // Alias
  });

  it('should evaluate regime using quantamental pipeline and LLM validation', async () => {
    const mockMacroData = { cpi: 3.0, gdp: 3.0 }; // Both at 0.75 normalized -> Inflationary Boom
    
    const mockLLMResponse = {
      classificationVerdict: 'Confirmed',
      challengeRationale: null,
      confidenceAdjustment: 5,
      keyDrivers: ['Driver 1'],
      confirmingIndicators: [],
      contradictingIndicators: [],
      transitionSignal: 'None',
      centralThesisConflict: 'No conflict',
      petrodollarRisk: 'Not Evidenced',
      petrodollarRationale: 'Stable',
      fastestPathToBeingWrong: 'Growth slowing',
      watchNext: [],
      requiresHumanReviewOverride: false,
      overrideReason: null
    };

    mockGenerateAgentResponse.mockResolvedValue(mockLLMResponse);

    const result = await runRegimeAgent(mockMacroData);

    expect(result.regimeQuadrant).toBe('Inflationary Boom');
    expect(result.classificationVerdict).toBe('Confirmed');
    expect(result.finalConfidence).toBeDefined();
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'regimeAgent',
      systemPrompt: expect.stringContaining('Mock Prompt')
    }));
  });

  it('should persist to DB and cache to JSON', async () => {
    const mockMacroData = { cpi: 2.0, gdp: 2.0 }; // Both at 0.5 normalized -> Boundary Zone
    
    const mockLLMResponse = {
      classificationVerdict: 'Confirmed',
      challengeRationale: null,
      confidenceAdjustment: 0,
      keyDrivers: ['Driver 1'],
      confirmingIndicators: [],
      contradictingIndicators: [],
      transitionSignal: 'None',
      centralThesisConflict: 'None',
      petrodollarRisk: 'Not Evidenced',
      petrodollarRationale: 'None',
      fastestPathToBeingWrong: 'None',
      watchNext: [],
      requiresHumanReviewOverride: false,
      overrideReason: null
    };

    mockGenerateAgentResponse.mockResolvedValue(mockLLMResponse);

    await runRegimeAgent(mockMacroData);

    expect(logRegimeEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      quadrant: 'Boundary Zone',
      data_inputs: mockMacroData
    }));
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('regime_latest.json'),
      expect.stringContaining('"regimeQuadrant": "Boundary Zone"')
    );
  });

  it('should throw error if prompt file is missing', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('regime_system.txt')) return false;
        return true;
    });
    
    await expect(runRegimeAgent({})).rejects.toThrow('System prompt file not found');
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
        if (path.includes('regime_pipeline.json')) return JSON.stringify({
            inflation_weights: { "cpi": 1.0 }, growth_weights: { "gdp": 1.0 }, 
            inflation_bounds: { "cpi": { low: 0, neutral: 2, high: 4 } }, 
            growth_bounds: { "gdp": { low: 0, neutral: 2, high: 4 } },
            regime_thresholds: { inflation_high: 0.6, inflation_low: 0.4, growth_high: 0.55, growth_low: 0.45, boundary_zone: 0.05 },
            staleness_limits_days: { daily: 1, weekly: 7, monthly: 30, quarterly: 90 }
        });
      }
      return JSON.stringify({});
    });

    mockGenerateAgentResponse.mockResolvedValue({
      classificationVerdict: 'Confirmed',
      confidenceAdjustment: 0,
      keyDrivers: [],
      petrodollarRisk: 'Not Evidenced',
      petrodollarRationale: '',
      fastestPathToBeingWrong: '',
      transitionSignal: '',
      centralThesisConflict: '',
      confirmingIndicators: [],
      contradictingIndicators: [],
      watchNext: [],
      requiresHumanReviewOverride: false,
      overrideReason: null
    });

    await runRegimeAgent({});

    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining('AAPL')
    }));
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.not.stringContaining('{{PORTFOLIO_CONTEXT}}')
    }));
  });
});
