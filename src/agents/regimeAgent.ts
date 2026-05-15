import fs from 'fs';
import path from 'path';
import { RegimeAssessment, RegimeAssessmentSchema, PortfolioConfigSchema } from '../types';
import { dbManager } from './db';
import { generateAgentResponse } from './baseAgent';
import { buildPortfolioContext } from '../utils/portfolioContext';
import { TARGET_SERIES } from '../data/fetchers/fredFetcher';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regime_latest.json');
const WEIGHTS_PATH = path.join(process.cwd(), 'config', 'regime_weights.json');
const POSITIONS_PATH = path.join(process.cwd(), 'config', 'positions.json');
const PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'regime_system.txt');

/**
 * Evaluates the current economic regime based on macro data.
 * @param macroData A record of macro indicator names and their values.
 * @param additionalContext Optional additional context from other sources (e.g. BLS, EIA).
 * @param trigger The trigger for this evaluation (manual, post_release, scheduled).
 * @returns A promise that resolves to a RegimeAssessment.
 */
export async function evaluateRegime(
  macroData: Record<string, number>,
  additionalContext: Record<string, any> = {},
  trigger: 'manual' | 'post_release' | 'scheduled' = 'manual'
): Promise<RegimeAssessment> {
  try {
    if (!fs.existsSync(PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${PROMPT_PATH}`);
    }

    let systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');

    // Inject Portfolio Context
    let positionsConfig = {};
    if (fs.existsSync(POSITIONS_PATH)) {
      try {
        const raw = fs.readFileSync(POSITIONS_PATH, 'utf8');
        if (raw.trim()) {
          positionsConfig = PortfolioConfigSchema.parse(JSON.parse(raw));
        }
      } catch (err) {
        console.warn(`Failed to parse positions config at ${POSITIONS_PATH}:`, err);
      }
    }
    const portfolioContext = buildPortfolioContext(positionsConfig);
    systemPrompt = systemPrompt.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

    // Load weights
    let weights = {};
    if (fs.existsSync(WEIGHTS_PATH)) {
      try {
        const raw = fs.readFileSync(WEIGHTS_PATH, 'utf8');
        if (raw.trim()) {
          weights = JSON.parse(raw);
        }
      } catch (err) {
        console.warn(`Failed to parse weights at ${WEIGHTS_PATH}:`, err);
      }
    }

    // Load prior assessment
    let priorAssessment = null;
    if (fs.existsSync(CACHE_PATH)) {
      try {
        const raw = fs.readFileSync(CACHE_PATH, 'utf8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          // Check if it's a valid assessment structure
          if (parsed && typeof parsed === 'object') {
            priorAssessment = parsed;
          }
        }
      } catch (err) {
        console.warn(`Failed to parse prior assessment at ${CACHE_PATH}:`, err);
      }
    }

    // Translate tickers to natural language descriptions
    const translatedMacroData: Record<string, number> = {};
    for (const [key, value] of Object.entries(macroData)) {
      const translatedKey = TARGET_SERIES[key] || key;
      translatedMacroData[translatedKey] = value;
    }

    const promptContext = {
      macro_indicators: translatedMacroData,
      regime_weights: weights,
      prior_assessment: priorAssessment,
      additional_context: additionalContext,
      current_time: new Date().toISOString(),
      trigger: trigger
    };

    const validated = await generateAgentResponse<RegimeAssessment>({
      agentName: 'regimeAgent',
      trigger: trigger,
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
      data_inputs: macroData, // Persist raw keys to db
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
