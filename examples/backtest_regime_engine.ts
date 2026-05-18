import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { MacroCacheSchema } from '../src/types/index.js';
import { runRegimeAgent } from '../src/agents/regimeAgent.js';
import { deriveMetrics } from '../src/data/fetchers/fredFetcher.js';

dotenv.config();

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'macroSnapshot.json');

/**
 * Backtesting Utility:
 * Feeds historical FRED data through the regime engine to verify quadrant classifications.
 */
async function backtest() {
  console.log('🧪 Starting Regime Engine Backtest...');

  try {
    // 1. Load historical data from cache
    const rawCache = await fs.readFile(CACHE_PATH, 'utf-8');
    const parsed = MacroCacheSchema.parse(JSON.parse(rawCache));
    const snapshot = parsed.data;

    // 2. Identify common dates for backtesting (last 12 months)
    const dates = snapshot.series['CPIAUCSL']
      .slice(-12)
      .map(p => p.date);

    console.log(`Testing across ${dates.length} periods: ${dates[0]} to ${dates[dates.length - 1]}`);

    const results = [];

    for (const date of dates) {
      process.stdout.write(`Processing ${date}... `);
      
      // 3. Derive metrics for this specific date using the engine's own logic
      const historicalValues = deriveMetrics(snapshot, date);

      // 4. Run Regime Agent
      // We pass a mock trigger to avoid side effects if any were present
      const regime = await runRegimeAgent(historicalValues, { isBacktest: true }, 'manual');
      
      results.push({
        date,
        quadrant: regime.regime_quadrant,
        confidence: regime.final_confidence,
        drift: regime.regime_drift_vs_prior
      });

      console.log(`✅ ${regime.regime_quadrant} (${regime.final_confidence}%)`);
    }

    // 5. Final Report
    console.log('\n📊 BACKTEST SUMMARY:');
    console.table(results);

  } catch (error) {
    console.error('\n❌ Backtest failed:', error);
  }
}

backtest();
