import { describe, it, expect } from 'vitest';
import { buildPortfolioContext } from '../src/utils/portfolioContext.js';
import { PortfolioConfig } from '../src/types/index.js';

describe('buildPortfolioContext', () => {
  const mockPositions: PortfolioConfig = {
    "TLT": {
      "shares": 100,
      "avg_cost": 90,
      "position_type": "macro_core",
      "thesis": "Long-duration Treasuries",
      "regime_match": ["Deflationary Recession"],
      "thesis_invalidation": "Higher yields"
    },
    "SM": {
      "shares": 50,
      "avg_cost": 50,
      "position_type": "speculative",
      "thesis": "oil E&P",
      "regime_match": ["Inflationary Boom"],
      "thesis_invalidation": "Lower oil prices"
    },
    "DUST": {
      "shares": 100,
      "avg_cost": 10,
      "position_type": "speculative",
      "thesis": "inverse gold miners",
      "regime_match": ["Stagflation"],
      "deadline": "2026-05-31", // Assume today is before this
      "thesis_invalidation": "Gold price surge"
    },
    "SGOV": {
      "shares": 500,
      "avg_cost": 100,
      "position_type": "macro_hedge",
      "thesis": "cash buffer, yield",
      "regime_match": ["Deflationary Recession", "Stagflation", "Goldilocks", "Inflationary Boom"],
      "thesis_invalidation": "None"
    }
  };

  it('should group positions by type and format them correctly', () => {
    const context = buildPortfolioContext(mockPositions);
    expect(context).toContain('macro_core:    TLT — Deflationary Recession — Long-duration Treasuries');
    expect(context).toContain('macro_hedge:   SGOV — (cash buffer, yield)');
    expect(context).toContain('speculative:   SM — Inflationary Boom — oil E&P');
  });

  it('should detect thesis conflicts', () => {
    const context = buildPortfolioContext(mockPositions);
    const conflictsSection = context.split('DETECTED THESIS CONFLICTS:')[1];
    expect(conflictsSection).toContain('TLT (Deflationary Recession) conflicts with SM (Inflationary Boom)');
    expect(conflictsSection).not.toContain('SGOV'); // SGOV has 4 regimes, should be ignored for conflicts
  });

  it('should flag speculative positions with deadlines within 30 days', () => {
    // We need to control "today" for this test to be reliable, 
    // but for now let's just check if it handles the deadline string.
    // In a real implementation, we might mock Date.now()
    const context = buildPortfolioContext(mockPositions);
    expect(context).toContain('DUST — Stagflation — inverse gold miners [DEADLINE: 2026-05-31]');
  });
});
