import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import {
  RebalancingReport,
  RebalancingReportSchema,
  RegimeSnapshot,
  PositionSnapshot,
  PortfolioConfig
} from '../data/types';
import { dbManager } from './db';
import dotenv from 'dotenv';

dotenv.config();

const REGIME_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regimeLatest.json');
const POSITIONS_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'positionsSnapshot.json');
const POSITIONS_CONFIG_PATH = path.join(process.cwd(), 'config', 'positions.json');
const PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'rebalancing_system.txt');
const REBALANCING_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'rebalancingLatest.json');

/**
 * Generates a portfolio rebalancing report based on current regime and positions.
 */
export async function generateRebalancingReport(): Promise<RebalancingReport> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    if (!fs.existsSync(PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${PROMPT_PATH}`);
    }

    const systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');

    // 1. Load Regime Snapshot
    if (!fs.existsSync(REGIME_CACHE_PATH)) {
      throw new Error(`Regime snapshot not found at ${REGIME_CACHE_PATH}. Run regime check first.`);
    }
    const regimeSnapshot: RegimeSnapshot = JSON.parse(fs.readFileSync(REGIME_CACHE_PATH, 'utf8'));

    // 2. Load Portfolio Snapshot (from IBKR fetcher)
    // Note: In a real scenario, we might want to ensure this is fresh.
    let positionSnapshots: PositionSnapshot[] = [];
    if (fs.existsSync(POSITIONS_CACHE_PATH)) {
      positionSnapshots = JSON.parse(fs.readFileSync(POSITIONS_CACHE_PATH, 'utf8'));
    }

    // 3. Load Positions Config (Theses, types, etc.)
    if (!fs.existsSync(POSITIONS_CONFIG_PATH)) {
      throw new Error(`Positions config not found at ${POSITIONS_CONFIG_PATH}`);
    }
    const positionsConfig: PortfolioConfig = JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8'));

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const promptContext = {
      regime_assessment: regimeSnapshot,
      portfolio_snapshot: positionSnapshots,
      positions_config: positionsConfig,
    };

    const modelName = process.env.REBALANCING_AGENT_MODEL || 'gemini-3-flash-preview';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${systemPrompt}\n\nContext:\n${JSON.stringify(promptContext, null, 2)}`,
      config: {
        responseMimeType: 'application/json',
      }
    });


    if (!response.text) {
      throw new Error('Empty response from Gemini API');
    }

    const rawJson = JSON.parse(response.text);
    const evaluatedAt = new Date().toISOString();

    const validated = RebalancingReportSchema.parse({
      ...rawJson,
      evaluatedAt,
    });

    // 4. Persist to SQLite
    dbManager.logRebalancingDecision({
      timestamp: evaluatedAt,
      alignment_score: validated.alignment_score,
      alignment_grade: validated.alignment_grade,
      position_assessments: validated.position_assessments,
      raw_response: rawJson,
    });

    // 5. Cache to JSON
    const cacheDir = path.dirname(REBALANCING_CACHE_PATH);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(REBALANCING_CACHE_PATH, JSON.stringify(validated, null, 2));

    return validated;
  } catch (error) {
    console.error('Error generating rebalancing report:', error);
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
      report.priority_actions.forEach(action => console.log(`- ${action}`));
    })
    .catch(err => {
      console.error('Failed to generate report:', err.message);
      process.exit(1);
    });
}
