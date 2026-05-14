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
    const mockPrompt = 'Mock Prompt Content';
    
    // Mock fs.readFileSync for the system prompt
    vi.mocked(fs.readFileSync).mockReturnValue(mockPrompt);
    
    // Mock GoogleGenAI response
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        quadrant: 'Goldilocks',
        confidence: 85,
        keyDrivers: ['Driver 1', 'Driver 2'],
        transitionSignal: 'None'
      })
    });

    const result = await evaluateRegime(mockMacroData);

    expect(result.quadrant).toBe('Goldilocks');
    expect(result.confidence).toBe(85);
    expect(result.keyDrivers).toEqual(['Driver 1', 'Driver 2']);
    expect(result.evaluatedAt).toBeDefined();
    
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('should persist to DB and cache to JSON', async () => {
    const mockMacroData = { inflation: 2.5, growth: 1.5 };
    vi.mocked(fs.readFileSync).mockReturnValue('Mock Prompt');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        quadrant: 'Goldilocks',
        confidence: 85,
        keyDrivers: ['Driver 1'],
        transitionSignal: 'None'
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
});
