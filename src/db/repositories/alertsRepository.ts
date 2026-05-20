import { BaseRepository } from './baseRepository.js';
import { Alert } from '../../types/index.js';

export class AlertsRepository extends BaseRepository {
  public insert(alert: Alert) {
    const stmt = this.db.prepare(`
      INSERT INTO alerts_sent (level, symbol, message, action)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(
      alert.level,
      alert.symbol || null,
      alert.message,
      alert.action || null
    );
  }

  public acknowledge(id: number) {
    const stmt = this.db.prepare(`
      UPDATE alerts_sent SET acknowledged = 1, ack_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(id);
  }

  public getAlerts(limit: number = 10): (Alert & { id: number; acknowledged: number })[] {
    const stmt = this.db.prepare(`
      SELECT * FROM alerts_sent ORDER BY sent_at DESC LIMIT ?
    `);
    return stmt.all(limit) as (Alert & { id: number; acknowledged: number })[];
  }

  public clear() {
    this.db.exec('DELETE FROM alerts_sent');
  }
}
