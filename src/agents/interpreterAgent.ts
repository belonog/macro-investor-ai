import fs from 'fs';
import path from 'path';
import { generateAgentResponse } from './baseAgent.js';
import {
  InterpreterOutput,
  InterpreterOutputSchema,
  PortfolioConfig,
  PrebriefOutput,
  PrebriefOutputSchema,
  EarningsEvent
} from '../types/index.js';
import { buildPortfolioContext } from '../utils/portfolioContext.js';

/**
 * Analyzes raw economic release data and produces structured output.
 * @param releaseName The name of the economic release (e.g., "CPI", "NFP").
 * @param releaseData The raw data of the release.
 * @param positionsConfig The current portfolio configuration.
 * @returns A promise that resolves to an InterpreterOutput.
 */
export async function runInterpreterAgent(
  releaseName: string,
  releaseData: string,
  positionsConfig: PortfolioConfig
): Promise<InterpreterOutput> {
  const templatePath = path.join(process.cwd(), 'src/prompts/interpreter_system.txt');
  const template = fs.readFileSync(templatePath, 'utf-8');
  
  const portfolioContext = buildPortfolioContext(positionsConfig);
  const systemPrompt = template.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

  const userPrompt = `Data Release: ${releaseName}\n\nRaw Data:\n${releaseData}`;

  return await generateAgentResponse({
    systemPrompt,
    prompt: userPrompt,
    schema: InterpreterOutputSchema,
    agentName: 'InterpreterAgent',
    trigger: 'manual'
  });
}

/**
 * Generates a pre-brief for an upcoming event.
 * @param symbol The symbol of the security.
 * @param thesis The current thesis for the security.
 * @param eventDetails Details about the upcoming event.
 * @param positionsConfig The current portfolio configuration.
 * @returns A promise that resolves to a PrebriefOutput.
 */
export async function generatePrebrief(
  symbol: string,
  thesis: string,
  eventDetails: EarningsEvent,
  positionsConfig: PortfolioConfig
): Promise<PrebriefOutput> {
  const templatePath = path.join(process.cwd(), 'src/prompts/prebrief_system.txt');
  const template = fs.readFileSync(templatePath, 'utf-8');

  const portfolioContext = buildPortfolioContext(positionsConfig);
  const systemPrompt = template.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

  const userPrompt = `
Upcoming Event for ${symbol}:
Thesis: ${thesis}
Event Details: ${JSON.stringify(eventDetails, null, 2)}
`.trim();

  return await generateAgentResponse({
    systemPrompt,
    prompt: userPrompt,
    schema: PrebriefOutputSchema,
    agentName: 'InterpreterAgent',
    trigger: 'scheduled'
  });
}
