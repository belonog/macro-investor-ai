import { RegimeAssessment } from '../types/index.js';

export function formatRegimeSummary(assessment: RegimeAssessment): string {
  const emoji = {
    'Goldilocks': '🟢',
    'Inflationary Boom': '🟡',
    'Stagflation': '🔴',
    'Deflationary Recession': '🌑',
    'Boundary Zone': '⚪'
  }[assessment.regime_quadrant] || '❓';

  return [
    `${emoji} *${assessment.regime_quadrant}* (${assessment.regime_drift_vs_prior})`,
    `*Scores:* Inflation: ${assessment.inflation_score.toFixed(2)} | Growth: ${assessment.growth_score.toFixed(2)}`,
    `*Confidence:* ${assessment.final_confidence}%`,
    `\n> ${assessment.transition_signal}`
  ].join('\n');
}

export function formatRegimeNarrative(assessment: RegimeAssessment): string {
  type ListItem = string | { indicator: string; value: string; signal?: string } | { release: string; watch_for?: string };
  const formatList = (items: ListItem[]) => {
    if (!items || items.length === 0) return '_None_';
    return items.map(item => {
      if (typeof item === 'string') return `• ${item}`;
      if ('indicator' in item && 'value' in item) {
        return `• *${item.indicator}* (${item.value}): ${item.signal || ''}`;
      }
      if ('release' in item) {
        return `• *${item.release}*: watch for ${item.watch_for || ''}`;
      }
      return `• ${JSON.stringify(item)}`;
    }).join('\n');
  };

  return [
    `*Big Picture:* ${assessment.classification_verdict}`,
    `${assessment.challenge_rationale}`,
    `\n*The Bull/Bear Case:*`,
    `*Confirming:*`,
    formatList(assessment.confirming_indicators),
    `\n*Contradicting:*`,
    formatList(assessment.contradicting_indicators),
    `\n*Risk & Watchlist:*`,
    `*Thesis Conflict:* ${assessment.central_thesis_conflict}`,
    `*Fastest Path to Wrong:* ${assessment.fastest_path_to_being_wrong}`,
    `\n*Next to Watch:*`,
    formatList(assessment.watch_next)
  ].join('\n');
}
