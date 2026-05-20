import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { DatabaseManager } from '../db/database.js';

export interface GenerateOptions<T> {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  agentName: string;
  trigger: 'scheduled' | 'post_release' | 'manual' | 'alert';
  model?: string;
}

export class LLMService {
  constructor(private db: DatabaseManager) {}

  public async generate<T>(options: GenerateOptions<T>): Promise<T> {
    const provider = process.env.AI_PROVIDER || 'google';
    const apiKey = provider === 'google' 
      ? process.env.GEMINI_API_KEY 
      : process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(`API key for provider ${provider} is not set.`);
    }

    const modelName = options.model || (
      options.agentName === 'regimeAgent' 
        ? process.env.REGIME_AGENT_MODEL 
        : process.env.REBALANCING_AGENT_MODEL
    ) || (provider === 'google' ? 'gemini-2.0-flash' : 'claude-3-5-sonnet-20241022');

    let model;
    if (provider === 'google') {
      const google = createGoogleGenerativeAI({ apiKey });
      model = google(modelName);
    } else {
      const anthropic = createAnthropic({ apiKey });
      model = anthropic(modelName);
    }

    let lastError: unknown;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await generateObject({
          model,
          schema: options.schema,
          system: options.systemPrompt,
          prompt: options.prompt,
        });

        // Telemetry logging
        this.db.insertAgentRun({
          agent: options.agentName,
          trigger: options.trigger,
          input_json: JSON.stringify({ system: options.systemPrompt, prompt: options.prompt }),
          output_json: JSON.stringify(result.object),
          model: modelName,
          tokens_used: result.usage?.totalTokens,
          run_at: new Date().toISOString(),
        });

        return result.object;
      } catch (error) {
        lastError = error;
        logger.error(error, `Attempt ${attempt} failed for agent ${options.agentName}`);
        
        if (attempt < maxRetries) {
          const delay = process.env.NODE_ENV === 'test' ? 0 : Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const lastErrorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Failed to generate LLM response for ${options.agentName} after ${maxRetries} attempts. Last error: ${lastErrorMessage}`);
  }
}
