
import { updateMacroCache, getLatestValues } from '../data/fetchers/fredFetcher.js';
import { getLatestReleases } from '../data/fetchers/blsFetcher.js';
import { getLatest as getLatestEia } from '../data/fetchers/eiaFetcher.js';
import { getGoldSpotPrice } from '../data/fetchers/polygonFetcher.js';
import { runRegimeAgent } from '../agents/regimeAgent.js';
import { generateRebalancingReport } from '../agents/rebalancingAgent.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import { formatRegimeSummary, formatRegimeNarrative } from '../utils/alertFormatter.js';
import { PositionSnapshot } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { db } from '../db/database.js';

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
    
    // 4. Send Narrative Alerts
    const summaryMsg = formatRegimeSummary(assessment);
    const narrativeMsg = formatRegimeNarrative(assessment);

    // Determine alert level based on drift
    const level = assessment.regime_drift_vs_prior === 'Shifted' 
      ? 'CRITICAL' 
      : (assessment.regime_drift_vs_prior === 'Transitioning' ? 'WARNING' : 'INFO');

    // Send Summary Message
    await sendTelegramAlert({
      level,
      message: summaryMsg,
      action: assessment.regime_drift_vs_prior === 'Shifted' ? 'Review Rebalancing Report' : null,
      created_at: new Date().toISOString(),
      symbol: null
    });

    // Send Narrative Message
    await sendTelegramAlert({
      level: 'INFO',
      message: narrativeMsg,
      action: null,
      created_at: new Date().toISOString(),
      symbol: null
    });

    // 5. Conditional Rebalancing Logic (Stays for logging/background info)
    if (['Transitioning', 'Shifted'].includes(assessment.regime_drift_vs_prior)) {
      // Verify fetched_at < 26h for portfolio snapshot (Spec v3 Flow 1 Step 6)
      try {
        const snapshots = db.getCache<PositionSnapshot[]>('positions_snapshot') || [];
        
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
        logger.error(err, `Failed to parse portfolio snapshot from cache`);
      }

      await generateRebalancingReport();
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
