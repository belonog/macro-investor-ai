import { BaseRepository } from './baseRepository.js';
import { RegimeAssessment } from '../../types/index.js';

export class RegimeHistoryRepository extends BaseRepository {
  public insert(assessment: RegimeAssessment & { data_inputs?: Record<string, unknown>; raw_response?: Record<string, unknown> }) {
    const stmt = this.db.prepare(`
      INSERT INTO regime_history (quadrant, confidence, inflation_score, growth_score, drift, full_output, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);

    return stmt.run(
      assessment.regime_quadrant || null,
      assessment.confidence,
      assessment.inflation_score !== undefined ? assessment.inflation_score : null,
      assessment.growth_score !== undefined ? assessment.growth_score : null,
      assessment.regime_drift_vs_prior || null,
      JSON.stringify(assessment),
      assessment.assessed_at || null
    );
  }

  public getLatest(): RegimeAssessment | null {
    const stmt = this.db.prepare(`
      SELECT full_output FROM regime_history ORDER BY assessed_at DESC LIMIT 1
    `);
    const row = stmt.get() as { full_output: string } | undefined;
    return row ? JSON.parse(row.full_output) : null;
  }

  public getHistory(limit: number = 10): RegimeAssessment[] {
    const stmt = this.db.prepare(`
      SELECT assessed_at, full_output FROM regime_history ORDER BY assessed_at DESC LIMIT ?
    `);
    return (stmt.all(limit) as { assessed_at: string; full_output: string }[]).map((row) => ({
      ...JSON.parse(row.full_output),
      assessed_at: row.assessed_at
    }));
  }

  public clear() {
    this.db.exec('DELETE FROM regime_history');
  }
}
