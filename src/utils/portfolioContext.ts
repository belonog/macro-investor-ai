import { PortfolioConfig, PositionType } from '../types/index.js';

const CONTRADICTORY_REGIMES: Record<string, string> = {
  'Inflationary Boom': 'Deflationary Recession',
  'Deflationary Recession': 'Inflationary Boom',
  'Goldilocks': 'Stagflation',
  'Stagflation': 'Goldilocks',
};

export function buildPortfolioContext(positionsConfig: PortfolioConfig): string {
  const lines: string[] = ['CURRENT PORTFOLIO CONTEXT (live from positions.json):', ''];

  const typeOrder: PositionType[] = ['macro_core', 'macro_hedge', 'speculative', 'equity_single'];
  const symbols = Object.keys(positionsConfig);

  for (const type of typeOrder) {
    const typedSymbols = symbols.filter(s => positionsConfig[s].position_type === type);
    if (typedSymbols.length === 0) continue;

    for (let i = 0; i < typedSymbols.length; i++) {
      const symbol = typedSymbols[i];
      const config = positionsConfig[symbol];
      const prefix = i === 0 ? `${type}:`.padEnd(15) : ' '.repeat(15);
      
      let detail = config.regime_match.length === 4
        ? `(${config.thesis})`
        : `${config.regime_match.join(', ')} — ${config.thesis}`;

      if (type === 'speculative' && config.deadline) {
        const deadlineDate = new Date(config.deadline);
        const now = new Date();
        const diffDays = (deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (diffDays <= 30) {
          detail += ` [DEADLINE: ${config.deadline}]`;
        }
      }

      lines.push(`${prefix}${symbol} — ${detail}`);
    }
    lines.push('');
  }

  // Detect thesis conflicts
  const conflicts: string[] = [];
  const symbolList = Object.keys(positionsConfig);

  for (let i = 0; i < symbolList.length; i++) {
    for (let j = i + 1; j < symbolList.length; j++) {
      const s1 = symbolList[i];
      const s2 = symbolList[j];
      const c1 = positionsConfig[s1];
      const c2 = positionsConfig[s2];

      // Ignore symbols that match all regimes (e.g. cash proxies) for conflict detection
      if (c1.regime_match.length === 4 || c2.regime_match.length === 4) continue;

      for (const r1 of c1.regime_match) {
        for (const r2 of c2.regime_match) {
          if (CONTRADICTORY_REGIMES[r1] === r2) {
            conflicts.push(`- ${s1} (${r1}) conflicts with ${s2} (${r2})`);
            // Avoid duplicate conflicts for the same pair
            break;
          }
        }
        if (conflicts.some(c => c.includes(`${s1} `) && c.includes(` with ${s2}`))) break;
      }
    }
  }

  if (conflicts.length > 0) {
    lines.push('DETECTED THESIS CONFLICTS:');
    lines.push(...conflicts);
  }

  return lines.join('\n').trim();
}
