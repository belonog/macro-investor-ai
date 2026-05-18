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
    
    // Support snake_case as primary, camelCase as fallback for legacy
    const quadrant = assessment.regime_quadrant ?? assessment.regimeQuadrant;
    const inflation_score = assessment.inflation_score ?? assessment.inflationScore;
    const growth_score = assessment.growth_score ?? assessment.growthScore;
    const drift = assessment.regime_drift_vs_prior ?? assessment.regimeDriftVsPrior;
    const assessed_at = assessment.assessed_at ?? assessment.assessedAt;

    return stmt.run(
      quadrant || null,
      assessment.confidence,
      inflation_score !== undefined ? inflation_score : null,
      growth_score !== undefined ? growth_score : null,
      drift || null,
      JSON.stringify(assessment),
      assessed_at || null
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

    const alignment_score = output.alignment_score ?? output.regime_portfolio_alignment_score;

    return stmt.run(
      alignment_score,
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

import { RegimeQuadrant, RebalancingOutput } from '../types/index.js';

export interface RegimeEvaluationRecord {
  timestamp: string;
  quadrant: RegimeQuadrant;
  confidence: number;
  inflation_score: number;
  growth_score: number;
  regime_drift_vs_prior: string;
  data_inputs: Record<string, any>;
  raw_response: Record<string, any>;
}

export function logRegimeEvaluation(evaluation: RegimeEvaluationRecord) {
  try {
    db.insertRegimeHistory({
      regime_quadrant: evaluation.quadrant,
      confidence: evaluation.confidence,
      inflation_score: evaluation.inflation_score,
      growth_score: evaluation.growth_score,
      regime_drift_vs_prior: evaluation.regime_drift_vs_prior,
      assessed_at: evaluation.timestamp,
      data_inputs: evaluation.data_inputs,
      raw_response: evaluation.raw_response
    });
    
    db.insertAgentRun({
      agent: 'regimeAgent',
      input_json: JSON.stringify(evaluation.data_inputs),
      output_json: JSON.stringify(evaluation.raw_response),
      run_at: evaluation.timestamp
    });
  } catch (error) {
    console.error('Failed to log regime evaluation:', error);
  }
}

export function logRebalancingDecision(decision: RebalancingOutput & { timestamp: string, raw_response?: any }) {
  try {
    db.insertRebalancingHistory(decision);

    if (decision.position_assessments && Array.isArray(decision.position_assessments)) {
      for (const pa of decision.position_assessments) {
        db.insertDecision({
          symbol: pa.symbol,
          action: pa.suggested_action,
          rationale: pa.action_rationale,
          regime_at_time: decision.timestamp,
          notes: pa.conflict_flag ?? undefined
        });
      }
    }

    db.insertAgentRun({
      agent: 'rebalancingAgent',
      output_json: JSON.stringify(decision.raw_response || decision),
      run_at: decision.timestamp
    });
  } catch (error) {
    console.error('Failed to log rebalancing decision:', error);
  }
}

export function logAlert(alert: Alert) {
  try {
    db.insertAlert(alert);
  } catch (error) {
    console.error('Failed to log alert:', error);
  }
}

export function getRecentAlerts(limit: number = 10): any[] {
  try {
    return db.getAlerts(limit);
  } catch (error) {
    console.error('Failed to get recent alerts:', error);
    return [];
  }
}

export function getRecentEvaluations(limit: number = 10): any[] {
  try {
    return db.getRegimeHistory(limit).map(assessment => ({
      timestamp: assessment.assessed_at,
      quadrant: assessment.regime_quadrant,
      confidence: assessment.confidence,
      data_inputs: assessment.data_inputs || {}, 
      raw_response: assessment.raw_response || assessment
    }));
  } catch (error) {
    console.error('Failed to get recent evaluations:', error);
    return [];
  }
}

export function clearEvaluations() {
  try {
    db.clearRegimeHistory();
  } catch (error) {
    console.error('Failed to clear evaluations:', error);
  }
}
