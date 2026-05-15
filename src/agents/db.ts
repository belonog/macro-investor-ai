import { db as newDb } from '../db/database.js';
import { RegimeQuadrant, Alert, RebalancingOutput } from '../types/index.js';

export interface RegimeEvaluationRecord {
  timestamp: string;
  quadrant: RegimeQuadrant;
  confidence: number;
  data_inputs: Record<string, any>;
  raw_response: Record<string, any>;
}

class DatabaseManager {
  private static instance: DatabaseManager;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public logRegimeEvaluation(evaluation: RegimeEvaluationRecord) {
    try {
      newDb.insertRegimeHistory({
        regime_quadrant: evaluation.quadrant,
        confidence: evaluation.confidence,
        assessed_at: evaluation.timestamp,
        data_inputs: evaluation.data_inputs,
        raw_response: evaluation.raw_response
      });
      
      newDb.insertAgentRun({
        agent: 'regimeAgent',
        input_json: JSON.stringify(evaluation.data_inputs),
        output_json: JSON.stringify(evaluation.raw_response),
        run_at: evaluation.timestamp
      });
    } catch (error) {
      console.error('Failed to log regime evaluation:', error);
    }
  }

  public logRebalancingDecision(decision: RebalancingOutput & { timestamp: string, raw_response?: any }) {
    try {
      newDb.insertRebalancingHistory(decision);

      if (decision.position_assessments && Array.isArray(decision.position_assessments)) {
        for (const pa of decision.position_assessments) {
          newDb.insertDecision({
            symbol: pa.symbol,
            action: pa.suggested_action,
            rationale: pa.action_rationale,
            regime_at_time: decision.timestamp,
            notes: pa.conflict_flag
          });
        }
      }

      newDb.insertAgentRun({
        agent: 'rebalancingAgent',
        output_json: JSON.stringify(decision.raw_response || decision),
        run_at: decision.timestamp
      });
    } catch (error) {
      console.error('Failed to log rebalancing decision:', error);
    }
  }

  public logAlert(alert: Alert) {
    try {
      newDb.insertAlert(alert);
    } catch (error) {
      console.error('Failed to log alert:', error);
    }
  }

  public getRecentAlerts(limit: number = 10): any[] {
    try {
      return newDb.getAlerts(limit);
    } catch (error) {
      console.error('Failed to get recent alerts:', error);
      return [];
    }
  }

  public getRecentEvaluations(limit: number = 10): any[] {
    try {
      return newDb.getRegimeHistory(limit).map(assessment => ({
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

  public clearEvaluations() {
    try {
      newDb.clearRegimeHistory();
    } catch (error) {
      console.error('Failed to clear evaluations:', error);
    }
  }

  public close() {
    try {
      newDb.close();
    } catch (error) {
      console.error('Failed to close database:', error);
    }
  }
}

export const dbManager = DatabaseManager.getInstance();
