import Database from 'better-sqlite3';

export class CacheRepository {
  constructor(private db: Database.Database) {}

  public get<T>(key: string): T | null {
    const stmt = this.db.prepare('SELECT value FROM app_cache WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    
    if (row && row.value) {
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  public set<T>(key: string, value: T): void {
    const stmt = this.db.prepare(`
      INSERT INTO app_cache (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP) 
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value, 
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, JSON.stringify(value));
  }

  public delete(key: string): void {
    const stmt = this.db.prepare('DELETE FROM app_cache WHERE key = ?');
    stmt.run(key);
  }
}
