import { BaseRepository } from './baseRepository.js';
import { DecisionLogEntry } from '../database.js';
import { RebalancingOutput } from '../../types/index.js';

export class DecisionRepository extends BaseRepository {
  public insertDecision(decision: DecisionLogEntry) {
    const stmt = this.db.prepare(`
      INSERT INTO decision_log (symbol, action, rationale, regime_at_time, price, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      decision.symbol,
      decision.action,
      decision.rationale,
      decision.regime_at_time,
      decision.price || null,
      decision.notes || null
    );
  }

  public insertRebalancingHistory(output: RebalancingOutput) {
    const stmt = this.db.prepare(`
      INSERT INTO rebalancing_history (alignment_score, alignment_grade, full_output)
      VALUES (?, ?, ?)
    `);

    return stmt.run(
      output.alignment_score,
      output.alignment_grade,
      JSON.stringify(output)
    );
  }

  public clear() {
    this.db.exec('DELETE FROM decision_log');
    this.db.exec('DELETE FROM rebalancing_history');
  }
}
