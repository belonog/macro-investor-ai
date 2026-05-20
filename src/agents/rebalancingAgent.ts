import fs from 'fs';
import {
  RebalancingOutput,
  RebalancingOutputSchema,
  RegimeAssessment,
  PositionSnapshot,
  PortfolioConfig,
  PortfolioConfigSchema
} from '../types/index.js';
import { logRebalancingDecision } from '../db/database.js';
import { generateAgentResponse } from './baseAgent.js';
import { buildPortfolioContext } from '../utils/portfolioContext.js';
import { StaleRegimeError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  REGIME_CACHE_PATH,
  POSITIONS_CACHE_PATH,
  POSITIONS_CONFIG_PATH,
  REBALANCING_PROMPT_PATH,
  REBALANCING_CACHE_PATH,
  CACHE_DIR
} from '../config/paths.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generates a portfolio rebalancing report based on current regime and positions.
 */
export async function generateRebalancingReport(): Promise<RebalancingOutput> {
  try {
    if (!fs.existsSync(REBALANCING_PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${REBALANCING_PROMPT_PATH}`);
    }

    let systemPrompt = fs.readFileSync(REBALANCING_PROMPT_PATH, 'utf8');

    // 1. Load Regime Snapshot
    if (!fs.existsSync(REGIME_CACHE_PATH)) {
      throw new Error(`Regime snapshot not found at ${REGIME_CACHE_PATH}. Run regime check first.`);
    }
    const regimeSnapshot: RegimeAssessment = JSON.parse(fs.readFileSync(REGIME_CACHE_PATH, 'utf8'));

    // Stale-data guard
    const assessed_at_raw = regimeSnapshot.assessed_at;
    const assessedAt = new Date(assessed_at_raw);
    const now = new Date();
    const diffDays = (now.getTime() - assessedAt.getTime()) / (1000 * 3600 * 24);
    if (diffDays > 7) {
      throw new StaleRegimeError(`Regime assessment is too old (${diffDays.toFixed(1)} days). Please run regime check first.`);
    }

    // 2. Load Portfolio Snapshot (from IBKR fetcher)
    let positionSnapshots: PositionSnapshot[] = [];
    if (fs.existsSync(POSITIONS_CACHE_PATH)) {
      positionSnapshots = JSON.parse(fs.readFileSync(POSITIONS_CACHE_PATH, 'utf8'));
    }

    // 3. Load Positions Config (Theses, types, etc.)
    if (!fs.existsSync(POSITIONS_CONFIG_PATH)) {
      throw new Error(`Positions config not found at ${POSITIONS_CONFIG_PATH}`);
    }
    const positionsConfig: PortfolioConfig = PortfolioConfigSchema.parse(
      JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8'))
    );

    // Inject Portfolio Context
    const portfolioContext = buildPortfolioContext(positionsConfig);
    systemPrompt = systemPrompt.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

    const promptContext = {
      regime_assessment: regimeSnapshot,
      portfolio_snapshot: positionSnapshots,
      positions_config: positionsConfig,
    };

    const validated = await generateAgentResponse<RebalancingOutput>({
      agentName: 'rebalancingAgent',
      trigger: 'manual',
      systemPrompt,
      prompt: `Context:\n${JSON.stringify(promptContext, null, 2)}`,
      schema: RebalancingOutputSchema,
    });

    // 4. Persist to SQLite
    logRebalancingDecision({
      ...validated,
      timestamp: validated.evaluated_at,
      raw_response: validated,
    });

    // 5. Cache to JSON
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(REBALANCING_CACHE_PATH, JSON.stringify(validated, null, 2));

    return validated;
  } catch (error) {
    logger.error(error, 'Error generating rebalancing report');
    throw error;
  }
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1])) {
  generateRebalancingReport()
    .then(report => {
      logger.info('Rebalancing Report Generated Successfully');
      logger.info({ 
        grade: report.alignment_grade, 
        score: report.alignment_score 
      }, 'Portfolio Alignment');
      logger.info({ 
        priority_actions: report.priority_actions 
      }, 'Priority Actions');
    })
    .catch(err => {
      logger.error(err, 'Failed to generate report');
      process.exit(1);
    });
}
