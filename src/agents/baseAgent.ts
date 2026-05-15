import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { db } from '../db/database.js';
import dotenv from 'dotenv';

dotenv.config();

export interface AgentCallOptions<T> {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  agentName: string;
  trigger: 'scheduled' | 'post_release' | 'manual';
  model?: string;
}

/**
 * Generates a structured response from an AI agent using the Vercel AI SDK.
 * Handles provider routing, retries, and database logging.
 */
export async function generateAgentResponse<T>(
  options: AgentCallOptions<T>
): Promise<T> {
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

  const model = provider === 'google' 
    ? google(modelName) 
    : anthropic(modelName);

  let lastError: any;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateObject({
        model,
        schema: options.schema,
        system: options.systemPrompt,
        prompt: options.prompt,
      });

      // Log the run to agent_runs.db
      db.insertAgentRun({
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
      console.error(`Attempt ${attempt} failed for agent ${options.agentName}:`, error);
      
      if (attempt < maxRetries) {
        // Simple exponential backoff: 2s, 4s
        const delay = process.env.NODE_ENV === 'test' ? 0 : Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to generate agent response for ${options.agentName} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}
