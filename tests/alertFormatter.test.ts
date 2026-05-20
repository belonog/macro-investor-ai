import { describe, it, expect } from 'vitest';
import { formatRegimeSummary, formatRegimeNarrative } from '../src/utils/alertFormatter.js';
import { RegimeAssessment } from '../src/types/index.js';

describe('alertFormatter', () => {
  it('should have formatRegimeSummary and formatRegimeNarrative functions', () => {
    expect(formatRegimeSummary).toBeDefined();
    expect(formatRegimeNarrative).toBeDefined();
  });

  it('should format summary correctly', () => {
    const mockAssessment = {
      regime_quadrant: 'Goldilocks',
      regime_drift_vs_prior: 'Stable',
      inflation_score: 0.45,
      growth_score: 0.75,
      final_confidence: 88,
      transition_signal: 'Conditions remain optimal for risk-on.',
    } as unknown as RegimeAssessment;

    const summary = formatRegimeSummary(mockAssessment);
    expect(summary).toContain('🟢 *Goldilocks* (Stable)');
    expect(summary).toContain('Inflation: 0.45');
    expect(summary).toContain('Growth: 0.75');
    expect(summary).toContain('*Confidence:* 88%');
    expect(summary).toContain('Conditions remain optimal for risk-on.');
  });

  it('should format narrative correctly', () => {
    const mockAssessment = {
      classification_verdict: 'Confirmed',
      challenge_rationale: 'Growth is accelerating while inflation moderates.',
      confirming_indicators: [
        { indicator: 'NFP', value: '300k', signal: 'Strong labor market' },
        { indicator: 'CPI', value: '3.1%', signal: 'Moderating inflation' }
      ],
      contradicting_indicators: [
        { indicator: 'WTI', value: '$85', signal: 'Energy cost pressure' }
      ],
      central_thesis_conflict: 'No major conflicts.',
      fastest_path_to_being_wrong: 'Sudden spike in energy prices.',
      watch_next: [
        { release: 'FOMC Meeting', watch_for: 'Rate hike signal' }
      ],
    } as unknown as RegimeAssessment;

    const narrative = formatRegimeNarrative(mockAssessment);
    expect(narrative).toContain('*Big Picture:* Confirmed');
    expect(narrative).toContain('Growth is accelerating');
    expect(narrative).toContain('• *NFP* (300k): Strong labor market');
    expect(narrative).toContain('• *WTI* ($85): Energy cost pressure');
    expect(narrative).toContain('*Thesis Conflict:* No major conflicts.');
    expect(narrative).toContain('Sudden spike in energy prices.');
    expect(narrative).toContain('• *FOMC Meeting*: watch for Rate hike signal');
  });
});
