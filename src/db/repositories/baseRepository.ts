import Database from 'better-sqlite3';

export class BaseRepository {
  protected db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }
}
