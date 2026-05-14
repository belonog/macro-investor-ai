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
    logRegimeEvaluation: vi.fn()
  }
}));

import { dbManager } from '../src/agents/db';
import { evaluateRegime } from '../src/agents/regimeAgent';

describe('regimeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should define evaluateRegime function', () => {
    expect(evaluateRegime).toBeDefined();
  });

  it('should evaluate regime using Gemini API', async () => {
    const mockMacroData = { inflation: 2.5, growth: 1.5 };
    
    // Mock fs.readFileSync
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (typeof path === 'string') {
        if (path.includes('regime_system.txt')) return 'Mock Prompt';
        if (path.includes('regime_weights.json')) return JSON.stringify({ weights: {} });
        if (path.includes('regimeLatest.json')) return JSON.stringify({ prior: {} });
      }
      return '';
    });
    
    // Mock GoogleGenAI response
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        quadrant: 'Goldilocks',
        confidence: 85,
        inflation_score: 0.3,
        growth_score: 0.7,
        regime_drift_vs_prior: 'Stable',
        keyDrivers: ['Driver 1', 'Driver 2'],
        confirming_indicators: ['Confirming 1'],
        contradicting_indicators: ['Contradicting 1'],
        central_thesis_conflict: 'No conflict',
        fastest_path_to_being_wrong: 'Growth slowing faster than expected',
        watch_next: ['Release 1'],
        transition_signal: 'None'
      })
    });

    const result = await evaluateRegime(mockMacroData);

    expect(result.quadrant).toBe('Goldilocks');
    expect(result.confidence).toBe(85);
    expect(result.inflation_score).toBe(0.3);
    expect(result.growth_score).toBe(0.7);
    expect(result.regime_drift_vs_prior).toBe('Stable');
    expect(result.evaluatedAt).toBeDefined();
    
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('should persist to DB and cache to JSON', async () => {
    const mockMacroData = { inflation: 2.5, growth: 1.5 };
    
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path.includes('regime_system.txt')) return 'Mock Prompt';
          if (path.includes('regime_weights.json')) return JSON.stringify({});
          if (path.includes('regimeLatest.json')) return JSON.stringify({});
        }
        return '';
      });

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        quadrant: 'Goldilocks',
        confidence: 85,
        inflation_score: 0.3,
        growth_score: 0.7,
        regime_drift_vs_prior: 'Stable',
        keyDrivers: ['Driver 1'],
        confirming_indicators: [],
        contradicting_indicators: [],
        central_thesis_conflict: 'None',
        fastest_path_to_being_wrong: 'None',
        watch_next: [],
        transition_signal: 'None'
      })
    });

    await evaluateRegime(mockMacroData);

    expect(dbManager.logRegimeEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      quadrant: 'Goldilocks',
      confidence: 85,
      data_inputs: mockMacroData
    }));
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('regimeLatest.json'),
      expect.stringContaining('"quadrant": "Goldilocks"')
    );
  });

  it('should throw error if GEMINI_API_KEY is missing', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    
    await expect(evaluateRegime({})).rejects.toThrow('GEMINI_API_KEY is not set');
    
    process.env.GEMINI_API_KEY = originalKey;
  });

  it('should throw error if prompt file is missing', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('regime_system.txt')) return false;
        return true;
    });
    
    await expect(evaluateRegime({})).rejects.toThrow('System prompt file not found');
  });

  it('should use model name from REGIME_AGENT_MODEL env var', async () => {
    const customModel = 'gemini-1.5-pro';
    process.env.REGIME_AGENT_MODEL = customModel;
    
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({
      quadrant: 'Goldilocks',
      confidence: 85,
      inflation_score: 0.3,
      growth_score: 0.7,
      regime_drift_vs_prior: 'Stable',
      keyDrivers: [],
      confirming_indicators: [],
      contradicting_indicators: [],
      central_thesis_conflict: '',
      fastest_path_to_being_wrong: '',
      watch_next: [],
      transition_signal: ''
    }) });

    await evaluateRegime({});

    const { GoogleGenAI } = await import('@google/genai');
    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: customModel
    }));

    delete process.env.REGIME_AGENT_MODEL;
  });
});
