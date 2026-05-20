import { BaseRepository } from './baseRepository.js';
import { AgentRun } from '../database.js';

export class AgentRunRepository extends BaseRepository {
  public insert(run: AgentRun) {
    const stmt = this.db.prepare(`
      INSERT INTO agent_runs (agent, trigger, input_hash, input_json, output_json, model, tokens_used, run_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    return stmt.run(
      run.agent,
      run.trigger || null,
      run.input_hash || null,
      run.input_json || null,
      run.output_json || null,
      run.model || null,
      run.tokens_used || null,
      run.run_at || null
    );
  }

  public clear() {
    this.db.exec('DELETE FROM agent_runs');
  }
}
