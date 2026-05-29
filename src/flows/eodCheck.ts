import { fetchPortfolioSnapshot } from '../data/fetchers/flexReportFetcher.js';
import { syncPositions } from '../utils/positionsSync.js';
import { getLatestValues } from '../data/macroSnapshot.js';
import { getEodPrices } from '../data/fetchers/polygonFetcher.js';
import { checkStopProximity, checkThesisThresholds, checkDeadlines } from '../monitor/eodMonitor.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import fs from 'fs';
import { PortfolioConfigSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { POSITIONS_CONFIG_PATH } from '../config/paths.js';
import { db } from '../db/database.js';
import { env } from '../config/env.js';

export async function runEodCheck() {
  try {
    logger.info('Starting EOD Check...');
    
    const token = env.IBKR_FLEX_TOKEN;
    const queryId = env.IBKR_FLEX_REPORT_ID;
    
    if (!token || !queryId) {
      throw new Error('IBKR Flex token or query ID missing');
    }
    
    // 1. Fetch Portfolio
    const snapshot = await fetchPortfolioSnapshot(token, queryId);
    
    // Cache the snapshot (Spec v3 requirement)
    db.setCache('positions_snapshot', snapshot);
    
    // 2. Sync Positions
    const positionsConfig = JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8'));
    const { updatedConfig, alerts } = syncPositions(snapshot, positionsConfig);
    fs.writeFileSync(POSITIONS_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
    
    for (const alert of alerts) {
      await sendTelegramAlert(alert);
    }
    
    // 3. Monitor
    const indicators = await getLatestValues();
    const typedConfig = PortfolioConfigSchema.parse(updatedConfig);
    
    // 4. Get EOD Prices from Polygon for stop checks (Spec v3)
    const symbols = Object.keys(typedConfig);
    const prices = await getEodPrices(symbols);
    
    const stopAlerts = checkStopProximity(prices, typedConfig);
    const thesisAlerts = checkThesisThresholds(indicators, typedConfig);
    const deadlineAlerts = checkDeadlines(typedConfig);
    
    for (const alert of [...stopAlerts, ...thesisAlerts, ...deadlineAlerts]) {
      await sendTelegramAlert(alert);
    }
    
    logger.info('EOD Check Completed Successfully.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(error, 'EOD Check Failed');
    await sendTelegramAlert({
      level: 'CRITICAL',
      message: `Alert: EOD Check Failed: ${message}`,
      created_at: new Date().toISOString(),
      symbol: null,
      action: 'Check logs'
    });
    throw error;
  }
}
