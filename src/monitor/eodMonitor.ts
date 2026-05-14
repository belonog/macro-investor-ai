import fs from 'fs';
import path from 'path';
import { 
  PositionSnapshot, 
  PortfolioConfig, 
  Alert, 
  PositionConfig 
} from '../data/types';
import { getLatestValues, TARGET_SERIES } from '../data/fetchers/fredFetcher';

const POSITIONS_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'positionsSnapshot.json');
const POSITIONS_CONFIG_PATH = path.join(process.cwd(), 'config', 'positions.json');

// Map descriptive names to FRED IDs for threshold monitoring
const INDICATOR_MAP: Record<string, string> = {
  'yield_30y': 'DGS30',
  'yield_10y': 'DGS10',
  'yield_2y': 'DGS2',
  'fed_funds': 'FEDFUNDS',
  'breakeven_5y5y': 'T5YIFR'
};

/**
 * Scans positions for stop breaches, thesis threshold crossings, and deadlines.
 */
export async function runEodMonitor(): Promise<Alert[]> {
  const alerts: Alert[] = [];

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

  // 2. Process each position
  for (const [symbol, posConfig] of Object.entries(config)) {
    const snapshot = snapshots.find(s => s.symbol === symbol);
    
    // 2.1 Stop Proximity Checks
    if (snapshot) {
      if (posConfig.hard_stop && snapshot.marketPrice <= posConfig.hard_stop) {
        alerts.push({
          level: 'CRITICAL',
          symbol,
          message: `Hard stop breached! Price: ${snapshot.marketPrice}, Hard Stop: ${posConfig.hard_stop}`,
          action: 'EXIT FULL'
        });
      } else if (posConfig.stop && snapshot.marketPrice <= posConfig.stop * 1.03) {
        alerts.push({
          level: 'WARNING',
          symbol,
          message: `Price approaching stop level. Price: ${snapshot.marketPrice}, Stop: ${posConfig.stop}`,
          action: 'REVIEW'
        });
      }
    }

    // 2.2 Thesis Threshold Checks
    if (posConfig.threshold_monitor) {
      const { indicator, warn_at, hard_exit_at } = posConfig.threshold_monitor;
      const fredId = INDICATOR_MAP[indicator];
      const currentValue = latestMacro[fredId];

      if (currentValue !== undefined) {
        // Assume thresholds are upper bounds (like yields rising) for now. 
        // In a more robust version, we'd check if it's a 'greater than' or 'less than' monitor.
        if (currentValue >= hard_exit_at) {
          alerts.push({
            level: 'CRITICAL',
            symbol,
            message: `Thesis invalidation threshold breached for ${indicator}! Value: ${currentValue}, Hard Exit: ${hard_exit_at}`,
            action: 'EXIT FULL'
          });
        } else if (currentValue >= warn_at) {
          alerts.push({
            level: 'WARNING',
            symbol,
            message: `Thesis threshold warning for ${indicator}. Value: ${currentValue}, Warning: ${warn_at}`,
            action: 'REDUCE RISK'
          });
        }
      }
    }

    // 2.3 Speculative Deadline Checks
    if (posConfig.deadline && posConfig.position_type === 'speculative') {
      const deadlineDate = new Date(posConfig.deadline);
      const today = new Date();
      const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        alerts.push({
          level: 'CRITICAL',
          symbol,
          message: `Speculative deadline reached: ${posConfig.deadline}`,
          action: 'EXIT FULL'
        });
      } else if (diffDays <= 5) {
        alerts.push({
          level: 'WARNING',
          symbol,
          message: `Speculative deadline approaching in ${diffDays} days: ${posConfig.deadline}`,
          action: 'WATCH'
        });
      }
    }
  }

  return alerts;
}
