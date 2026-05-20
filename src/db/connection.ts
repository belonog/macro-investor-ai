import Database from 'better-sqlite3';
import fs from 'fs';
import { env } from '../config/env.js';
import { LOGS_DIR, DB_PATH } from '../config/paths.js';

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const isTest = env.NODE_ENV === 'test';
export const dbConnection: Database.Database = new Database(isTest ? ':memory:' : DB_PATH);

export function initSchemas(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      agent       TEXT NOT NULL,
      trigger     TEXT,
      input_hash  TEXT,
      input_json  TEXT,
      output_json TEXT,
      model       TEXT,
      tokens_used INTEGER
    );

    CREATE TABLE IF NOT EXISTS regime_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      assessed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      quadrant        TEXT,
      confidence      REAL,
      inflation_score REAL,
      growth_score    REAL,
      drift           TEXT,
      full_output     TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts_sent (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      level        TEXT,
      symbol       TEXT,
      message      TEXT,
      action       TEXT,
      acknowledged INTEGER DEFAULT 0,
      ack_at       TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS decision_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      symbol         TEXT,
      action         TEXT,
      rationale      TEXT,
      regime_at_time TEXT,
      price          REAL,
      notes          TEXT
    );

    CREATE TABLE IF NOT EXISTS rebalancing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      alignment_score REAL,
      alignment_grade TEXT,
      full_output TEXT
    );

    CREATE TABLE IF NOT EXISTS app_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
