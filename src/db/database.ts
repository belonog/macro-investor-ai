import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { 
  RegimeAssessment, 
  Alert
} from '../types/index.js';

const LOGS_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export interface AgentRun {
  agent: string;
  trigger?: string;
  input_hash?: string;
  input_json?: string;
  output_json?: string;
  model?: string;
  tokens_used?: number;
  run_at?: string;
}

export interface DecisionLogEntry {
  symbol: string;
  action: string;
  rationale: string;
  regime_at_time: string;
  price?: number;
  notes?: string;
}

export class DatabaseManager {
  private agentRunsDb: Database.Database;
  private regimeHistoryDb: Database.Database;
  private alertsSentDb: Database.Database;
  private decisionLogDb: Database.Database;
  private rebalancingHistoryDb: Database.Database;

  constructor() {
    const isTest = process.env.NODE_ENV === 'test';
    
    this.agentRunsDb = new Database(isTest ? ':memory:' : path.join(LOGS_DIR, 'agent_runs.db'));
    this.regimeHistoryDb = new Database(isTest ? ':memory:' : path.join(LOGS_DIR, 'regime_history.db'));
    this.alertsSentDb = new Database(isTest ? ':memory:' : path.join(LOGS_DIR, 'alerts_sent.db'));
    this.decisionLogDb = new Database(isTest ? ':memory:' : path.join(LOGS_DIR, 'decision_log.db'));
    this.rebalancingHistoryDb = new Database(isTest ? ':memory:' : path.join(LOGS_DIR, 'rebalancing_history.db'));

    this.initSchemas();
  }

  private initSchemas() {
    this.agentRunsDb.exec(`
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
    `);

    this.regimeHistoryDb.exec(`
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
    `);

    this.alertsSentDb.exec(`
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
    `);

    this.decisionLogDb.exec(`
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
    `);

    this.rebalancingHistoryDb.exec(`
      CREATE TABLE IF NOT EXISTS rebalancing_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        alignment_score REAL,
        alignment_grade TEXT,
        full_output TEXT
      );
    `);
  }

  // Insert Helpers
  public insertAgentRun(run: AgentRun) {
    const stmt = this.agentRunsDb.prepare(`
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

  public insertRegimeHistory(assessment: any) {
    console.log('insertRegimeHistory assessment:', JSON.stringify(assessment, null, 2));
    const stmt = this.regimeHistoryDb.prepare(`
      INSERT INTO regime_history (quadrant, confidence, inflation_score, growth_score, drift, full_output, assessed_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    `);
    return stmt.run(
      assessment.regime_quadrant,
      assessment.confidence,
      assessment.inflation_score !== undefined ? assessment.inflation_score : null,
      assessment.growth_score !== undefined ? assessment.growth_score : null,
      assessment.regime_drift_vs_prior || null,
      JSON.stringify(assessment),
      assessment.assessed_at || null
    );
  }

  public insertAlert(alert: Alert) {
    const stmt = this.alertsSentDb.prepare(`
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

  public insertDecision(decision: DecisionLogEntry) {
    const stmt = this.decisionLogDb.prepare(`
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

  public insertRebalancingHistory(output: any) {
    const stmt = this.rebalancingHistoryDb.prepare(`
      INSERT INTO rebalancing_history (alignment_score, alignment_grade, full_output)
      VALUES (?, ?, ?)
    `);
    return stmt.run(
      output.regime_portfolio_alignment_score,
      output.alignment_grade,
      JSON.stringify(output)
    );
  }

  // Query Helpers
  public getLatestRegime(): RegimeAssessment | null {
    const stmt = this.regimeHistoryDb.prepare(`
      SELECT full_output FROM regime_history ORDER BY assessed_at DESC LIMIT 1
    `);
    const row = stmt.get() as { full_output: string } | undefined;
    return row ? JSON.parse(row.full_output) : null;
  }

  public getRegimeHistory(limit: number = 10): any[] {
    const stmt = this.regimeHistoryDb.prepare(`
      SELECT assessed_at, full_output FROM regime_history ORDER BY assessed_at DESC LIMIT ?
    `);
    return stmt.all(limit).map((row: any) => ({
      ...JSON.parse(row.full_output),
      assessed_at: row.assessed_at
    }));
  }

  public acknowledgeAlert(id: number) {
    const stmt = this.alertsSentDb.prepare(`
      UPDATE alerts_sent SET acknowledged = 1, ack_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    return stmt.run(id);
  }

  public getAlerts(limit: number = 10): any[] {
    const stmt = this.alertsSentDb.prepare(`
      SELECT * FROM alerts_sent ORDER BY sent_at DESC LIMIT ?
    `);
    return stmt.all(limit);
  }

  public clearRegimeHistory() {
    this.regimeHistoryDb.exec('DELETE FROM regime_history');
    this.agentRunsDb.exec('DELETE FROM agent_runs');
  }

  public close() {
    this.agentRunsDb.close();
    this.regimeHistoryDb.close();
    this.alertsSentDb.close();
    this.decisionLogDb.close();
    this.rebalancingHistoryDb.close();
  }
}

export const db = new DatabaseManager();
