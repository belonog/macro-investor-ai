import fs from 'fs';
import path from 'path';
import { generateAgentResponse } from './baseAgent';
import { 
  CoherenceOutput, 
  CoherenceOutputSchema, 
  PortfolioConfig, 
  RegimeAssessment 
} from '../types';
import { buildPortfolioContext } from '../utils/portfolioContext';

export interface CoherenceInput {
  symbol: string;
  thesis: string;
  proposedSizeUsd: number;
  currentBook: PortfolioConfig;
  currentRegime: RegimeAssessment;
}

export async function runCoherenceAgent(input: CoherenceInput): Promise<CoherenceOutput> {
  const templatePath = path.join(process.cwd(), 'src/prompts/coherence_system.txt');
  const template = fs.readFileSync(templatePath, 'utf-8');
  
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
