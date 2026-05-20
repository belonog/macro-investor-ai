import fs from 'fs';
import { 
  RegimeAssessment, 
  PortfolioConfigSchema,
  PipelineInput,
  MacroIndicators,
  RawIndicator,
  PriorAssessment,
  LLMResponseSchema
} from '../types/index.js';
import { logRegimeEvaluation, db } from '../db/database.js';
import { generateAgentResponse } from './baseAgent.js';
import { buildPortfolioContext } from '../utils/portfolioContext.js';
import { runPipeline, buildLLMInput, mergePipelineAndLLM } from './regimePipeline.js';
import { logger } from '../utils/logger.js';
import {
  POSITIONS_CONFIG_PATH,
  REGIME_PROMPT_PATH
} from '../config/paths.js';
import dotenv from 'dotenv';

dotenv.config();

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
    if (!fs.existsSync(REGIME_PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${REGIME_PROMPT_PATH}`);
    }

    let systemPrompt = fs.readFileSync(REGIME_PROMPT_PATH, 'utf8');

    // 1. Inject Portfolio Context
    let positionsConfig = {};
    if (fs.existsSync(POSITIONS_CONFIG_PATH)) {
      try {
        const raw = fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8');
        if (raw.trim()) {
          positionsConfig = PortfolioConfigSchema.parse(JSON.parse(raw));
        }
      } catch (err) {
        logger.warn(err, `Failed to parse positions config at ${POSITIONS_CONFIG_PATH}`);
      }
    }
    const portfolioContext = buildPortfolioContext(positionsConfig);
    systemPrompt = systemPrompt.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

    // 2. Load prior assessment for drift detection
    let priorAssessment: PriorAssessment | null = null;
    const rawPrior = db.getCache<RegimeAssessment>('regime_latest');
    if (rawPrior) {
      try {
        priorAssessment = {
          regime_quadrant: rawPrior.regime_quadrant,
          inflation_score: rawPrior.inflation_score,
          growth_score: rawPrior.growth_score,
          confidence: rawPrior.final_confidence,
          assessed_at: rawPrior.assessed_at,
        };
      } catch (err) {
        logger.warn(err, `Failed to parse prior assessment from cache`);
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
          description: key,
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

    db.setCache('regime_latest', finalAssessment);

    return finalAssessment;
  } catch (error) {
    logger.error(error, 'Error running regime agent');
    throw error;
  }
}

/**
 * Backward compatibility alias for runRegimeAgent.
 * @deprecated Use runRegimeAgent instead.
 */
export const evaluateRegime = runRegimeAgent;
