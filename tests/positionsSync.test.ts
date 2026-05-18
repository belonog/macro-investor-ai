import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncPositions } from '../src/utils/positionsSync.js';
import { PositionSnapshot, PortfolioConfig } from '../src/types.js';
import fs from 'fs';
import path from 'path';

describe('positionsSync', () => {
  const tempConfigPath = path.join(__dirname, 'temp_positions.json');

  beforeEach(() => {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  });

  it('updates shares and avg_cost for existing symbols', () => {
    const snapshot: PositionSnapshot[] = [
      {
        symbol: 'TLT',
        quantity: 120,
        avgCost: 92.5,
        marketPrice: 93,
        marketValue: 11160,
        unrealizedPnl: 60,
        unrealizedPnlPct: 0.54,
        fetchedAt: new Date().toISOString(),
      },
    ];

    const positionsConfig: PortfolioConfig = {
      TLT: {
        shares: 100,
        avg_cost: 90.0,
        position_type: 'macro_core',
        thesis: 'Thesis',
        regime_match: ['Deflationary Recession'],
        thesis_invalidation: 'Invalidation',
      },
    };

    const result = syncPositions(snapshot, positionsConfig, 'dummy/path');

    expect(result.updatedConfig.TLT.shares).toBe(120);
    expect(result.updatedConfig.TLT.avg_cost).toBe(92.5);
    // Ensure other fields are preserved
    expect(result.updatedConfig.TLT.thesis).toBe('Thesis');
  });

  it('writes updated config to file if path is provided', () => {
    const snapshot: PositionSnapshot[] = [
      {
        symbol: 'TLT',
        quantity: 120,
        avgCost: 92.5,
        marketPrice: 93,
        marketValue: 11160,
        unrealizedPnl: 60,
        unrealizedPnlPct: 0.54,
        fetchedAt: new Date().toISOString(),
      },
    ];

    const positionsConfig: PortfolioConfig = {
      TLT: {
        shares: 100,
        avg_cost: 90.0,
        position_type: 'macro_core',
        thesis: 'Thesis',
        regime_match: ['Deflationary Recession'],
        thesis_invalidation: 'Invalidation',
      },
    };

    syncPositions(snapshot, positionsConfig, tempConfigPath);

    expect(fs.existsSync(tempConfigPath)).toBe(true);
    const writtenConfig = JSON.parse(fs.readFileSync(tempConfigPath, 'utf8'));
    expect(writtenConfig.TLT.shares).toBe(120);
  });

  it('alerts on new unrecognized symbols', () => {
    const snapshot: PositionSnapshot[] = [
      {
        symbol: 'NVDA',
        quantity: 10,
        avgCost: 800,
        marketPrice: 900,
        marketValue: 9000,
        unrealizedPnl: 1000,
        unrealizedPnlPct: 12.5,
        fetchedAt: new Date().toISOString(),
      },
    ];

    const positionsConfig: PortfolioConfig = {};

    const result = syncPositions(snapshot, positionsConfig, 'dummy/path');

    expect(result.alerts).toContainEqual(expect.objectContaining({
      level: 'WARNING',
      symbol: 'NVDA',
      message: expect.stringContaining('New unrecognized symbol'),
    }));
  });

  it('alerts on removed symbols (closed positions)', () => {
    const snapshot: PositionSnapshot[] = [];

    const positionsConfig: PortfolioConfig = {
      TLT: {
        shares: 100,
        avg_cost: 90.0,
        position_type: 'macro_core',
        thesis: 'Thesis',
        regime_match: ['Deflationary Recession'],
        thesis_invalidation: 'Invalidation',
      },
    };

    const result = syncPositions(snapshot, positionsConfig, 'dummy/path');

    expect(result.alerts).toContainEqual(expect.objectContaining({
      level: 'WARNING',
      symbol: 'TLT',
      message: expect.stringContaining('Closed position detected'),
    }));
    // Should we remove it from config? Task says "auto-updates quantitative fields", "Semantic fields ... are never touched".
    // Usually we don't want to auto-delete from config if it has a thesis, maybe just set shares to 0?
    // User says: "Alert on removed symbols (closed positions)."
    expect(result.updatedConfig.TLT.shares).toBe(0);
  });

  it('handles multiple changes (update, new, removed) correctly', () => {
    const snapshot: PositionSnapshot[] = [
      {
        symbol: 'TLT',
        quantity: 120,
        avgCost: 92.5,
        marketPrice: 93,
        marketValue: 11160,
        unrealizedPnl: 60,
        unrealizedPnlPct: 0.54,
        fetchedAt: new Date().toISOString(),
      },
      {
        symbol: 'NVDA',
        quantity: 10,
        avgCost: 800,
        marketPrice: 900,
        marketValue: 9000,
        unrealizedPnl: 1000,
        unrealizedPnlPct: 12.5,
        fetchedAt: new Date().toISOString(),
      },
    ];

    const positionsConfig: PortfolioConfig = {
      TLT: {
        shares: 100,
        avg_cost: 90.0,
        position_type: 'macro_core',
        thesis: 'Thesis TLT',
        regime_match: ['Deflationary Recession'],
        thesis_invalidation: 'Invalidation TLT',
      },
      GLD: {
        shares: 50,
        avg_cost: 200.0,
        position_type: 'macro_hedge',
        thesis: 'Thesis GLD',
        regime_match: ['Stagflation'],
        thesis_invalidation: 'Invalidation GLD',
      },
    };

    const result = syncPositions(snapshot, positionsConfig, 'dummy/path');

    // TLT updated
    expect(result.updatedConfig.TLT.shares).toBe(120);
    expect(result.updatedConfig.TLT.avg_cost).toBe(92.5);

    // GLD removed
    expect(result.updatedConfig.GLD.shares).toBe(0);
    expect(result.alerts).toContainEqual(expect.objectContaining({
      symbol: 'GLD',
      message: expect.stringContaining('Closed position detected'),
    }));

    // NVDA new
    expect(result.alerts).toContainEqual(expect.objectContaining({
      symbol: 'NVDA',
      message: expect.stringContaining('New unrecognized symbol'),
    }));
  });
});
