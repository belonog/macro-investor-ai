import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { RegimeQuadrant } from '../data/types';

const IS_TEST = process.env.NODE_ENV === 'test';
const DB_PATH = IS_TEST ? ':memory:' : path.join(process.cwd(), 'logs', 'macro_investor.db');

export interface RegimeEvaluationRecord {
  timestamp: string;
  quadrant: RegimeQuadrant;
  confidence: number;
  data_inputs: any;
  raw_response: any;
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database;

  private constructor() {
    if (!IS_TEST) {
      const logsDir = path.dirname(DB_PATH);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
    }

    this.db = new Database(DB_PATH);
    this.initSchema();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS regime_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        quadrant TEXT NOT NULL,
        confidence REAL NOT NULL,
        data_inputs TEXT NOT NULL,
        raw_response TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rebalancing_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        alignment_score REAL NOT NULL,
        alignment_grade TEXT NOT NULL,
        position_assessments TEXT NOT NULL,
        raw_response TEXT NOT NULL
      );
    `);
  }

  public logRegimeEvaluation(evaluation: RegimeEvaluationRecord) {
    const stmt = this.db.prepare(`
      INSERT INTO regime_evaluations (timestamp, quadrant, confidence, data_inputs, raw_response)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      evaluation.timestamp,
      evaluation.quadrant,
      evaluation.confidence,
      JSON.stringify(evaluation.data_inputs),
      JSON.stringify(evaluation.raw_response)
    );
  }

  public logRebalancingDecision(decision: any) {
    const stmt = this.db.prepare(`
      INSERT INTO rebalancing_decisions (timestamp, alignment_score, alignment_grade, position_assessments, raw_response)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      decision.timestamp,
      decision.alignment_score,
      decision.alignment_grade,
      JSON.stringify(decision.position_assessments),
      JSON.stringify(decision.raw_response)
    );
  }

  public getRecentEvaluations(limit: number = 10): any[] {
    const stmt = this.db.prepare(`SELECT * FROM regime_evaluations ORDER BY timestamp DESC LIMIT ?`);
    return stmt.all(limit).map((row: any) => ({
      ...row,
      data_inputs: JSON.parse(row.data_inputs),
      raw_response: JSON.parse(row.raw_response)
    }));
  }

  // For testing purposes
  public clearEvaluations() {
    this.db.exec(`DELETE FROM regime_evaluations`);
  }

  // For testing purposes
  public close() {
    this.db.close();
  }
}

export const dbManager = DatabaseManager.getInstance();
