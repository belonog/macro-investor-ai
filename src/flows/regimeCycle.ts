import fs from 'fs';
import path from 'path';
import { updateMacroCache, getLatestValues } from '../data/fetchers/fredFetcher.js';
import { getLatestReleases } from '../data/fetchers/blsFetcher.js';
import { getLatest as getLatestEia } from '../data/fetchers/eiaFetcher.js';
import { getGoldSpotPrice } from '../data/fetchers/polygonFetcher.js';
import { runRegimeAgent } from '../agents/regimeAgent.js';
import { generateRebalancingReport } from '../agents/rebalancingAgent.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import { PositionSnapshot } from '../types/index.js';

const POSITIONS_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'positions_snapshot.json');

export async function runRegimeCycle(trigger: 'manual' | 'post_release' | 'scheduled' = 'manual') {
  try {
    console.log(`Starting Regime Cycle (Trigger: ${trigger})...`);
    
    // 1. Update Macro Data
    await updateMacroCache();
    const flatSnapshot = await getLatestValues();

    // Add gold price from Polygon
    flatSnapshot.gold_price = await getGoldSpotPrice();

    // 2. Fetch BLS and EIA data (Spec v3 Flow 1 Steps 2 & 3)
    const blsData = await getLatestReleases();
    const eiaData = await getLatestEia();
    
    // 3. Run Regime Agent
    const assessment = await runRegimeAgent(flatSnapshot, { bls: blsData, eia: eiaData }, trigger);
    
    // 4. Conditional Rebalancing
    if (['Transitioning', 'Shifted'].includes(assessment.regimeDriftVsPrior)) {
      // Verify fetchedAt < 26h for portfolio snapshot (Spec v3 Flow 1 Step 6)
      if (fs.existsSync(POSITIONS_CACHE_PATH)) {
        try {
          const raw = fs.readFileSync(POSITIONS_CACHE_PATH, 'utf8');
          const snapshots: PositionSnapshot[] = raw.trim() ? JSON.parse(raw) : [];
          
          if (snapshots.length > 0) {
            const fetchedAt = new Date(snapshots[0].fetchedAt);
            const now = new Date();
            const diffHours = (now.getTime() - fetchedAt.getTime()) / (1000 * 3600);
            
            if (diffHours > 26) {
              console.warn(`Portfolio snapshot is stale (${diffHours.toFixed(1)}h). Rebalancing report might be inaccurate.`);
            }
          } else {
            console.warn('Portfolio snapshot is empty. Rebalancing report will be incomplete.');
          }
        } catch (err) {
          console.error(`Failed to parse portfolio snapshot at ${POSITIONS_CACHE_PATH}:`, err);
        }
      } else {
        console.warn('Portfolio snapshot not found. Rebalancing report will be incomplete.');
      }

      const report = await generateRebalancingReport();
      await sendTelegramAlert({
        level: assessment.regimeDriftVsPrior === 'Shifted' ? 'CRITICAL' : 'WARNING',
        message: `Regime ${assessment.regimeDriftVsPrior}: ${assessment.regimeQuadrant}\nAlignment: ${report.alignment_grade} (${(report.regime_portfolio_alignment_score * 100).toFixed(0)}%)`,
        action: 'Review Rebalancing Report',
        createdAt: new Date().toISOString(),
        symbol: null
      });
    } else {
      await sendTelegramAlert({
        level: 'INFO',
        message: `Regime Stable: ${assessment.regimeQuadrant} (Confidence: ${assessment.finalConfidence}%)`,
        createdAt: new Date().toISOString(),
        symbol: null,
        action: null
      });
    }
  } catch (error: any) {
    console.error('Regime Cycle Failed:', error);
    await sendTelegramAlert({
      level: 'CRITICAL',
      message: `Alert: Regime Cycle Failed: ${error.message || error}`,
      createdAt: new Date().toISOString(),
      symbol: null,
      action: 'Check logs'
    });
    throw error;
  }
}
