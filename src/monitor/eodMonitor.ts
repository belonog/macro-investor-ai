import fs from 'fs';
import { 
  PositionSnapshot, 
  PortfolioConfig, 
  Alert, 
  MacroIndicators,
} from '../types/index.js';
import { getLatestValues } from '../data/macroSnapshot.js';
import { POSITIONS_CACHE_PATH, POSITIONS_CONFIG_PATH } from '../config/paths.js';

// Map descriptive names to semantic keys for threshold monitoring
const INDICATOR_MAP: Record<string, string> = {
  'yield_30y': 'yield_30y_pct',
  'yield_10y': 'yield_10y_pct',
  'yield_2y': 'yield_2y_pct',
  'fed_funds': 'fed_funds_rate_pct',
  'breakeven_5y5y': 'forward_5y5y_pct'
};

/**
 * Checks for stop breaches based on current prices.
 */
export function checkStopProximity(prices: Record<string, number>, config: PortfolioConfig): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  for (const [symbol, posConfig] of Object.entries(config)) {
    const price = prices[symbol];
    if (price !== undefined) {
      if (posConfig.hard_stop && price <= posConfig.hard_stop) {
        alerts.push({
          level: 'CRITICAL',
          symbol,
          message: `Hard stop breached! Price: ${price}, Hard Stop: ${posConfig.hard_stop}`,
          action: 'EXIT FULL',
          created_at: now,
        });
      } else if (posConfig.stop && price <= posConfig.stop * 1.03) {
        alerts.push({
          level: 'WARNING',
          symbol,
          message: `Price approaching stop level. Price: ${price}, Stop: ${posConfig.stop}`,
          action: 'REVIEW',
          created_at: now,
        });
      }
    }
  }
  return alerts;
}

/**
 * Checks if macro indicators have crossed thesis invalidation thresholds.
 */
export function checkThesisThresholds(indicators: MacroIndicators, config: PortfolioConfig): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  for (const [symbol, posConfig] of Object.entries(config)) {
    if (posConfig.threshold_monitor) {
      const { indicator, warn_at, hard_exit_at } = posConfig.threshold_monitor;
      const fredId = INDICATOR_MAP[indicator];
      const indicatorObj = indicators[fredId];
      const currentValue = indicatorObj?.value;

      if (currentValue !== undefined) {
        if (currentValue >= hard_exit_at) {
          alerts.push({
            level: 'CRITICAL',
            symbol,
            message: `Thesis invalidation threshold breached for ${indicator}! Value: ${currentValue}, Hard Exit: ${hard_exit_at}`,
            action: 'EXIT FULL',
            created_at: now,
          });
        } else if (currentValue >= warn_at) {
          alerts.push({
            level: 'WARNING',
            symbol,
            message: `Thesis threshold warning for ${indicator}. Value: ${currentValue}, Warning: ${warn_at}`,
            action: 'REDUCE RISK',
            created_at: now,
          });
        }
      }
    }
  }
  return alerts;
}

/**
 * Checks for approaching deadlines in speculative positions.
 */
export function checkDeadlines(config: PortfolioConfig): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  for (const [symbol, posConfig] of Object.entries(config)) {
    if (posConfig.deadline && posConfig.position_type === 'speculative') {
      const deadlineDate = new Date(posConfig.deadline);
      const today = new Date();
      const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        alerts.push({
          level: 'CRITICAL',
          symbol,
          message: `Speculative deadline reached: ${posConfig.deadline}`,
          action: 'EXIT FULL',
          created_at: now,
        });
      } else if (diffDays <= 5) {
        alerts.push({
          level: 'WARNING',
          symbol,
          message: `Speculative deadline approaching in ${diffDays} days: ${posConfig.deadline}`,
          action: 'WATCH',
          created_at: now,
        });
      }
    }
  }
  return alerts;
}

/**
 * Scans positions for stop breaches, thesis threshold crossings, and deadlines.
 * Legacy function kept for backward compatibility if needed.
 */
export async function runEodMonitor(): Promise<Alert[]> {
  // 1. Load data
  if (!fs.existsSync(POSITIONS_CONFIG_PATH)) {
    throw new Error('Positions config not found');
  }
  const config: PortfolioConfig = JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8'));

  let snapshots: PositionSnapshot[] = [];
  if (fs.existsSync(POSITIONS_CACHE_PATH)) {
    snapshots = JSON.parse(fs.readFileSync(POSITIONS_CACHE_PATH, 'utf8'));
  }

  const latestMacro = await getLatestValues();
  const prices: Record<string, number> = {};
  for (const s of snapshots) {
    prices[s.symbol] = s.market_price;
  }

  const stopAlerts = checkStopProximity(prices, config);
  const thesisAlerts = checkThesisThresholds(latestMacro, config);
  const deadlineAlerts = checkDeadlines(config);

  return [...stopAlerts, ...thesisAlerts, ...deadlineAlerts];
}
