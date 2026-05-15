import fs from 'fs';
import path from 'path';
import { RegimeAssessment, RegimeAssessmentSchema, PortfolioConfigSchema } from '../types';
import { dbManager } from './db';
import { generateAgentResponse } from './baseAgent';
import { buildPortfolioContext } from '../utils/portfolioContext';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regimeLatest.json');
const WEIGHTS_PATH = path.join(process.cwd(), 'config', 'regime_weights.json');
const POSITIONS_PATH = path.join(process.cwd(), 'config', 'positions.json');
const PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'regime_system.txt');

/**
 * Evaluates the current economic regime based on macro data.
 * @param macroData A record of macro indicator names and their values.
 * @returns A promise that resolves to a RegimeAssessment.
 */
export async function evaluateRegime(macroData: Record<string, number>): Promise<RegimeAssessment> {
  try {
    if (!fs.existsSync(PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${PROMPT_PATH}`);
    }

    let systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');

    // Inject Portfolio Context
    const positionsConfig = fs.existsSync(POSITIONS_PATH)
      ? PortfolioConfigSchema.parse(JSON.parse(fs.readFileSync(POSITIONS_PATH, 'utf8')))
      : {};
    const portfolioContext = buildPortfolioContext(positionsConfig);
    systemPrompt = systemPrompt.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

    // Load weights
    const weights = fs.existsSync(WEIGHTS_PATH)
      ? JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'))
      : {};

    // Load prior assessment
    const priorAssessment = fs.existsSync(CACHE_PATH)
      ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
      : null;

    const promptContext = {
      macro_indicators: macroData,
      regime_weights: weights,
      prior_assessment: priorAssessment,
      current_time: new Date().toISOString(),
    };

    const validated = await generateAgentResponse<RegimeAssessment>({
      agentName: 'regimeAgent',
      trigger: 'manual',
      systemPrompt,
      prompt: `Context:\n${JSON.stringify(promptContext, null, 2)}`,
      schema: RegimeAssessmentSchema,
    });

    // 1. Persist to SQLite via dbManager
    // Note: generateAgentResponse already logs to agent_runs.db
    dbManager.logRegimeEvaluation({
      timestamp: validated.assessed_at,
      quadrant: validated.regime_quadrant,
      confidence: validated.confidence,
      data_inputs: macroData,
      raw_response: validated,
    });

    // 2. Cache to JSON
    const cacheDir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(validated, null, 2));

    return validated;
  } catch (error) {
    console.error('Error evaluating regime:', error);
    throw error;
  }
}
