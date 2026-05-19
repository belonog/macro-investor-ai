import fs from 'fs';
import path from 'path';
import { 
  RegimeAssessment, 
  PortfolioConfigSchema,
  PipelineInput,
  MacroIndicators,
  RawIndicator,
  PriorAssessment,
  LLMResponseSchema
} from '../types/index.js';
import { logRegimeEvaluation } from '../db/database.js';
import { generateAgentResponse } from './baseAgent.js';
import { buildPortfolioContext } from '../utils/portfolioContext.js';
import { runPipeline, buildLLMInput, mergePipelineAndLLM } from './regimePipeline.js';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regime_latest.json');
const POSITIONS_PATH = path.join(process.cwd(), 'config', 'positions.json');
const PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'regime_system.txt');

/**
 * Runs the Regime Agent using the quantamental pipeline and LLM validation.
 * @param macroData A record of macro indicator names and their values (or RawIndicator objects).
 * @param additionalContext Optional additional context from other sources.
 * @param trigger The trigger for this evaluation.
 * @returns A promise that resolves to a RegimeAssessment (FinalAssessment).
 */
export async function runRegimeAgent(
  macroData: Record<string, number | RawIndicator>,
  additionalContext: Record<string, unknown> = {},
  trigger: 'manual' | 'post_release' | 'scheduled' | 'alert' = 'manual'
): Promise<RegimeAssessment> {
  try {
    if (!fs.existsSync(PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${PROMPT_PATH}`);
    }

    let systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');

    // 1. Inject Portfolio Context
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

    // 2. Load prior assessment for drift detection
    let priorAssessment: PriorAssessment | null = null;
    if (fs.existsSync(CACHE_PATH)) {
      try {
        const raw = fs.readFileSync(CACHE_PATH, 'utf8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          // priorAssessment expects snake_case fields per Spec v3
          priorAssessment = {
            regime_quadrant: parsed.regime_quadrant,
            inflation_score: parsed.inflation_score,
            growth_score: parsed.growth_score,
            confidence: parsed.confidence,
            assessed_at: parsed.assessed_at,
          };
        }
      } catch (err) {
        console.warn(`Failed to parse prior assessment at ${CACHE_PATH}:`, err);
      }
    }

    // 3. Prepare Pipeline Input
    const indicators: MacroIndicators = {};
    for (const [key, val] of Object.entries(macroData)) {
      if (typeof val === 'number') {
        // Fallback for any legacy number-only data, but ideally fetchers provide RawIndicator
        indicators[key] = {
          value: val,
          unit: 'N/A',
          as_of: new Date().toISOString().split('T')[0],
          source: 'unknown',
        };
      } else {
        indicators[key] = val;
      }
    }

    const pipelineInput: PipelineInput = {
      indicators,
      prior_assessment: priorAssessment,
      portfolio_context: portfolioContext,
      current_time: new Date().toISOString(),
      trigger,
    };

    // 4. Run Quantitative Pipeline
    const pipelineOutput = runPipeline(pipelineInput);

    // 5. Build LLM Input
    const llmInput = buildLLMInput(pipelineOutput, pipelineInput);
    const fullContext = {
      ...JSON.parse(llmInput),
      additional_context: additionalContext,
    };

    // 6. Call LLM for Validation
    const llmResponse = await generateAgentResponse({
      agentName: 'regimeAgent',
      trigger,
      systemPrompt,
      prompt: `Quantitative Pipeline Output and Context:\n${JSON.stringify(fullContext, null, 2)}`,
      schema: LLMResponseSchema,
    });

    // 7. Merge Pipeline and LLM results
    const finalAssessment = mergePipelineAndLLM(pipelineOutput, llmResponse);

    // 8. Persist and Cache
    logRegimeEvaluation({
      timestamp: finalAssessment.assessed_at,
      quadrant: finalAssessment.regime_quadrant,
      confidence: finalAssessment.final_confidence,
      inflation_score: finalAssessment.inflation_score,
      growth_score: finalAssessment.growth_score,
      regime_drift_vs_prior: finalAssessment.regime_drift_vs_prior,
      data_inputs: macroData,
      raw_response: finalAssessment,
    });

    const cacheDir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(finalAssessment, null, 2));

    return finalAssessment;
  } catch (error) {
    console.error('Error running regime agent:', error);
    throw error;
  }
}

/**
 * Backward compatibility alias for runRegimeAgent.
 * @deprecated Use runRegimeAgent instead.
 */
export const evaluateRegime = runRegimeAgent;
