import fs from 'fs';
import { updateMacroCache, getLatestValues } from '../data/fetchers/fredFetcher.js';
import { getLatestReleases } from '../data/fetchers/blsFetcher.js';
import { getLatest as getLatestEia } from '../data/fetchers/eiaFetcher.js';
import { getGoldSpotPrice } from '../data/fetchers/polygonFetcher.js';
import { runRegimeAgent } from '../agents/regimeAgent.js';
import { generateRebalancingReport } from '../agents/rebalancingAgent.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import { PositionSnapshot } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { POSITIONS_CACHE_PATH } from '../config/paths.js';

export async function runRegimeCycle(trigger: 'manual' | 'post_release' | 'scheduled' = 'manual') {
  try {
    logger.info(`Starting Regime Cycle (Trigger: ${trigger})...`);
    
    // 1. Update Macro Data
    await updateMacroCache();
    const flatSnapshot = await getLatestValues();

    // Add gold price from Polygon
    flatSnapshot.gold_price_usd = await getGoldSpotPrice();

    // 2. Fetch BLS and EIA data (Spec v3 Flow 1 Steps 2 & 3)
    const blsData = await getLatestReleases();
    const eiaData = await getLatestEia();
    
    // 3. Run Regime Agent
    const assessment = await runRegimeAgent(flatSnapshot, { bls: blsData, eia: eiaData }, trigger);
    
    // 4. Conditional Rebalancing
    if (['Transitioning', 'Shifted'].includes(assessment.regime_drift_vs_prior)) {
      // Verify fetched_at < 26h for portfolio snapshot (Spec v3 Flow 1 Step 6)
      if (fs.existsSync(POSITIONS_CACHE_PATH)) {
        try {
          const raw = fs.readFileSync(POSITIONS_CACHE_PATH, 'utf8');
          const snapshots: PositionSnapshot[] = raw.trim() ? JSON.parse(raw) : [];
          
          if (snapshots.length > 0) {
            const fetched_at_raw = snapshots[0].fetched_at;
            const fetchedAt = new Date(fetched_at_raw);
            const now = new Date();
            const diffHours = (now.getTime() - fetchedAt.getTime()) / (1000 * 3600);
            
            if (diffHours > 26) {
              logger.warn(`Portfolio snapshot is stale (${diffHours.toFixed(1)}h). Rebalancing report might be inaccurate.`);
            }
          } else {
            logger.warn('Portfolio snapshot is empty. Rebalancing report will be incomplete.');
          }
        } catch (err) {
          logger.error(err, `Failed to parse portfolio snapshot at ${POSITIONS_CACHE_PATH}`);
        }
      } else {
        logger.warn('Portfolio snapshot not found. Rebalancing report will be incomplete.');
      }

      const report = await generateRebalancingReport();
      await sendTelegramAlert({
        level: assessment.regime_drift_vs_prior === 'Shifted' ? 'CRITICAL' : 'WARNING',
        message: `Regime ${assessment.regime_drift_vs_prior}: ${assessment.regime_quadrant}\nAlignment: ${report.alignment_grade} (${(report.alignment_score * 100).toFixed(0)}%)`,
        action: 'Review Rebalancing Report',
        created_at: new Date().toISOString(),
        symbol: null
      });
    } else {
      await sendTelegramAlert({
        level: 'INFO',
        message: `Regime Stable: ${assessment.regime_quadrant} (Confidence: ${assessment.final_confidence}%)`,
        created_at: new Date().toISOString(),
        symbol: null,
        action: null
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(error, 'Regime Cycle Failed');
    await sendTelegramAlert({
      level: 'CRITICAL',
      message: `Alert: Regime Cycle Failed: ${message}`,
      created_at: new Date().toISOString(),
      symbol: null,
      action: 'Check logs'
    });
    throw error;
  }
}
