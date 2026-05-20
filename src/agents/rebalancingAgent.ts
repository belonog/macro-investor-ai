import fs from 'fs';
import path from 'path';
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
import dotenv from 'dotenv';

dotenv.config();

const REGIME_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regime_latest.json');
const POSITIONS_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'positions_snapshot.json');
const POSITIONS_CONFIG_PATH = path.join(process.cwd(), 'config', 'positions.json');
const PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'rebalancing_system.txt');
const REBALANCING_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'rebalancingLatest.json');

/**
 * Generates a portfolio rebalancing report based on current regime and positions.
 */
export async function generateRebalancingReport(): Promise<RebalancingOutput> {
  try {
    if (!fs.existsSync(PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${PROMPT_PATH}`);
    }

    let systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');

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
    const cacheDir = path.dirname(REBALANCING_CACHE_PATH);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
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
      console.log('Rebalancing Report Generated Successfully');
      console.log(`Grade: ${report.alignment_grade} (Score: ${report.alignment_score})`);
      console.log('\nPriority Actions:');
      report.priority_actions.forEach((action: string) => console.log(`- ${action}`));
    })
    .catch(err => {
      console.error('Failed to generate report:', err.message);
      process.exit(1);
    });
}
