import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { PortfolioConfig } from '../src/types/index.js';

const { mockGenerateAgentResponse } = vi.hoisted(() => ({
  mockGenerateAgentResponse: vi.fn()
}));

vi.mock('../src/agents/baseAgent', () => ({
  generateAgentResponse: mockGenerateAgentResponse
}));

vi.mock('fs');

import { runInterpreterAgent } from '../src/agents/interpreterAgent.js';

describe('InterpreterAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.includes('interpreter_system.txt')) {
        return 'Mock Prompt with {{PORTFOLIO_CONTEXT}}';
      }
      return '';
    });
  });

  it('should analyze release data and return structured output', async () => {
    const mockOutput = {
      confirms: ['Growth is strong'],
      contradicts: ['Inflation is falling'],
      ambiguous: ['Wage growth'],
      resolution_requirement: 'Wait for next CPI',
      summary_markdown: '# Summary\nGrowth is strong but inflation is sticky.'
    };

    mockGenerateAgentResponse.mockResolvedValue(mockOutput);

    const result = await runInterpreterAgent(
      'Non-Farm Payrolls',
      'NFP: 300k, Unemployment: 3.8%',
      {}
    );

    expect(result).toEqual(mockOutput);
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'InterpreterAgent',
      systemPrompt: expect.stringContaining('Mock Prompt'),
      prompt: expect.stringContaining('Non-Farm Payrolls')
    }));
  });

  it('should inject portfolio context into system prompt', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.includes('interpreter_system.txt')) {
        return 'PROMPT: {{PORTFOLIO_CONTEXT}}';
      }
      return '';
    });

    mockGenerateAgentResponse.mockResolvedValue({
      confirms: [],
      contradicts: [],
      ambiguous: [],
      resolution_requirement: 'None',
      summary_markdown: 'None'
    });

    const mockPositions = {
      'AAPL': {
        shares: 10,
        avg_cost: 150,
        position_type: 'equity_single',
        thesis: 'Good company',
        regime_match: ['Goldilocks'],
        thesis_invalidation: 'Bad earnings'
      }
    } satisfies PortfolioConfig;

    await runInterpreterAgent('Test Release', 'Test Data', mockPositions);

    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining('AAPL')
    }));
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.not.stringContaining('{{PORTFOLIO_CONTEXT}}')
    }));
  });
});
