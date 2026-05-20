
import { db } from '../db/database.js';
import { LLMService, GenerateOptions } from '../services/llmGateway.js';
import dotenv from 'dotenv';

dotenv.config();

export interface AgentCallOptions<T> extends GenerateOptions<T> {
  llmService?: LLMService;
}

/**
 * Generates a structured response from an AI agent using the LLM Service.
 * Allows dependency injection of llmService, falling back to a default instance.
 */
export async function generateAgentResponse<T>(
  options: AgentCallOptions<T>
): Promise<T> {
  const service = options.llmService || new LLMService(db);
  return service.generate({
    systemPrompt: options.systemPrompt,
    prompt: options.prompt,
    schema: options.schema,
    agentName: options.agentName,
    trigger: options.trigger,
    model: options.model,
  });
}
