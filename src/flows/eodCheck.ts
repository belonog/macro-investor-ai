import { fetchPortfolioSnapshot } from '../data/fetchers/flexReportFetcher.js';
import { syncPositions } from '../utils/positionsSync.js';
import { getLatestValues } from '../data/fetchers/fredFetcher.js';
import { getEodPrices } from '../data/fetchers/polygonFetcher.js';
import { checkStopProximity, checkThesisThresholds, checkDeadlines } from '../monitor/eodMonitor.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import fs from 'fs';
import path from 'path';
import { PortfolioConfigSchema } from '../types/index.js';

const POSITIONS_CONFIG_PATH = path.join(process.cwd(), 'config', 'positions.json');
const POSITIONS_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'positions_snapshot.json');

export async function runEodCheck() {
  try {
    console.log('Starting EOD Check...');
    
    const token = process.env.IBKR_FLEX_TOKEN;
    const queryId = process.env.IBKR_FLEX_REPORT_ID;
    
    if (!token || !queryId) {
      throw new Error('IBKR Flex token or query ID missing');
    }
    
    // 1. Fetch Portfolio
    const snapshot = await fetchPortfolioSnapshot(token, queryId);
    
    // Cache the snapshot (Spec v3 requirement)
    if (!fs.existsSync(path.dirname(POSITIONS_CACHE_PATH))) {
      fs.mkdirSync(path.dirname(POSITIONS_CACHE_PATH), { recursive: true });
    }
    fs.writeFileSync(POSITIONS_CACHE_PATH, JSON.stringify(snapshot, null, 2));
    
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
    
    console.log('EOD Check Completed Successfully.');
  } catch (error: any) {
    console.error('EOD Check Failed:', error);
    await sendTelegramAlert({
      level: 'CRITICAL',
      message: `Alert: EOD Check Failed: ${error.message || error}`,
      createdAt: new Date().toISOString(),
      symbol: null,
      action: 'Check logs'
    });
    throw error;
  }
}
