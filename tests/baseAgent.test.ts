import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAgentResponse } from '../src/agents/baseAgent.js';
import { z } from 'zod';
import { db } from '../src/db/database.js';

// Mock AI SDK and providers
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/google', () => {
  const googleMock = vi.fn();
  return {
    createGoogleGenerativeAI: vi.fn(() => googleMock),
    google: googleMock,
  };
});

vi.mock('@ai-sdk/anthropic', () => {
  const anthropicMock = vi.fn();
  return {
    createAnthropic: vi.fn(() => anthropicMock),
    anthropic: anthropicMock,
  };
});

// Mock database
vi.mock('../src/db/database', () => ({
  db: {
    insertAgentRun: vi.fn(),
  },
}));

describe('baseAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_PROVIDER = 'google';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-key-anthropic';
  });

  it('should call generateObject and log the run', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockResolvedValue({
      object: { test: 'value' },
      usage: { totalTokens: 100 },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const schema = z.object({ test: z.string() });
    const result = await generateAgentResponse({
      systemPrompt: 'sys',
      prompt: 'p',
      schema,
      agentName: 'testAgent',
      trigger: 'manual',
    });

    expect(result).toEqual({ test: 'value' });
    expect(db.insertAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agent: 'testAgent',
      trigger: 'manual',
      model: expect.any(String),
      tokens_used: 100,
    }));
  });

  it('should retry on failure and eventually succeed', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockResolvedValueOnce({
        object: { test: 'success' },
        usage: { totalTokens: 50 },
      } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const schema = z.object({ test: z.string() });
    
    const result = await generateAgentResponse({
      systemPrompt: 'sys',
      prompt: 'p',
      schema,
      agentName: 'testAgent',
      trigger: 'manual',
    });

    expect(result).toEqual({ test: 'success' });
    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(db.insertAgentRun).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries', async () => {
    const { generateObject } = await import('ai');
    vi.mocked(generateObject).mockRejectedValue(new Error('Permanent Fail'));

    const schema = z.object({ test: z.string() });
    
    await expect(generateAgentResponse({
      systemPrompt: 'sys',
      prompt: 'p',
      schema,
      agentName: 'testAgent',
      trigger: 'manual',
    })).rejects.toThrow(/Permanent Fail/);

    expect(generateObject).toHaveBeenCalledTimes(3);
    expect(db.insertAgentRun).not.toHaveBeenCalled();
  });

  it('should use the correct provider based on AI_PROVIDER', async () => {
    const { google } = await import('@ai-sdk/google');
    const { anthropic } = await import('@ai-sdk/anthropic');
    const { generateObject } = await import('ai');
    
    vi.mocked(generateObject).mockResolvedValue({
      object: { test: 'value' },
      usage: { totalTokens: 10 },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    // Test Anthropic
    process.env.AI_PROVIDER = 'anthropic';
    await generateAgentResponse({
      systemPrompt: 'sys',
      prompt: 'p',
      schema: z.object({ test: z.string() }),
      agentName: 'testAgent',
      trigger: 'manual',
    });
    expect(anthropic).toHaveBeenCalled();

    // Test Google
    process.env.AI_PROVIDER = 'google';
    await generateAgentResponse({
      systemPrompt: 'sys',
      prompt: 'p',
      schema: z.object({ test: z.string() }),
      agentName: 'testAgent',
      trigger: 'manual',
    });
    expect(google).toHaveBeenCalled();
  });
});
