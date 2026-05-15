import fs from 'fs';
import path from 'path';
import { PositionSnapshot, PortfolioConfig, SyncResult, Alert } from '../types';

/**
 * Synchronizes shares and avg_cost from IBKR Flex snapshot to positions.json config.
 * Alerts on new unrecognized symbols and removed symbols (closed positions).
 */
export function syncPositions(
  snapshot: PositionSnapshot[],
  positionsConfig: PortfolioConfig,
  configPath: string
): SyncResult {
  const updatedConfig: PortfolioConfig = JSON.parse(JSON.stringify(positionsConfig));
  const alerts: Alert[] = [];

  const snapshotSymbols = new Set(snapshot.map(s => s.symbol));
  const configSymbols = new Set(Object.keys(positionsConfig));

  // 1. Update existing and alert on new
  for (const pos of snapshot) {
    if (configSymbols.has(pos.symbol)) {
      updatedConfig[pos.symbol].shares = pos.quantity;
      updatedConfig[pos.symbol].avg_cost = pos.avgCost;
    } else {
      alerts.push({
        level: 'WARNING',
        symbol: pos.symbol,
        message: `New unrecognized symbol found in IBKR: ${pos.symbol}. Quantity: ${pos.quantity}`,
        action: 'Add to positions.json if this is a new intentional position.',
      });
    }
  }

  // 2. Alert on removed (closed) positions
  for (const symbol of configSymbols) {
    if (!snapshotSymbols.has(symbol)) {
      // If it's in config but not in snapshot, it's closed (or not reported)
      if (updatedConfig[symbol].shares > 0) {
        alerts.push({
          level: 'WARNING',
          symbol: symbol,
          message: `Closed position detected: ${symbol} is no longer in IBKR snapshot.`,
          action: 'Verify if position was intentionally closed and update thesis if needed.',
        });
        updatedConfig[symbol].shares = 0;
      }
    }
  }

  // 3. Write to file if path is provided and it's not a dummy path
  if (configPath && configPath !== 'dummy/path' && fs.existsSync(path.dirname(configPath))) {
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8');
  }

  return {
    updatedConfig,
    alerts,
  };
}
