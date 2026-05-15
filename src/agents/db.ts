import { db as newDb } from '../db/database';
import { RegimeQuadrant } from '../types';

export interface RegimeEvaluationRecord {
  timestamp: string;
  quadrant: RegimeQuadrant;
  confidence: number;
  data_inputs: any;
  raw_response: any;
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
  }

  public logRebalancingDecision(decision: any) {
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
  }

  public getRecentEvaluations(limit: number = 10): any[] {
    return newDb.getRegimeHistory(limit).map(assessment => ({
      timestamp: assessment.assessed_at,
      quadrant: assessment.regime_quadrant,
      confidence: assessment.confidence,
      data_inputs: assessment.data_inputs || {}, 
      raw_response: assessment.raw_response || assessment
    }));
  }

  public clearEvaluations() {
    newDb.clearRegimeHistory();
  }

  public close() {
    newDb.close();
  }
}

export const dbManager = DatabaseManager.getInstance();
