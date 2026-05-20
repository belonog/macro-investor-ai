import fs from 'fs';
import { generateAgentResponse } from './baseAgent.js';
import { 
  CoherenceOutput, 
  CoherenceOutputSchema, 
  PortfolioConfig, 
  RegimeAssessment 
} from '../types/index.js';
import { buildPortfolioContext } from '../utils/portfolioContext.js';
import { COHERENCE_PROMPT_PATH } from '../config/paths.js';

export interface CoherenceInput {
  symbol: string;
  thesis: string;
  proposedSizeUsd: number;
  currentBook: PortfolioConfig;
  currentRegime: RegimeAssessment;
}

export async function runCoherenceAgent(input: CoherenceInput): Promise<CoherenceOutput> {
  const template = fs.readFileSync(COHERENCE_PROMPT_PATH, 'utf-8');
  
  const portfolioContext = buildPortfolioContext(input.currentBook);
  const systemPrompt = template.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

  const userPrompt = `
PROPOSED TRADE:
Symbol: ${input.symbol}
Thesis: ${input.thesis}
Proposed Size: $${input.proposedSizeUsd}

CURRENT REGIME:
${JSON.stringify(input.currentRegime, null, 2)}
  `;

  return await generateAgentResponse({
    systemPrompt,
    prompt: userPrompt,
    schema: CoherenceOutputSchema,
    agentName: 'CoherenceAgent',
    trigger: 'manual'
  });
}
