import { dbConnection, initSchemas } from './connection.js';
import { AgentRunRepository } from './repositories/agentRunRepository.js';
import { RegimeHistoryRepository } from './repositories/regimeHistoryRepository.js';
import { AlertsRepository } from './repositories/alertsRepository.js';
import { DecisionRepository } from './repositories/decisionRepository.js';
import { CacheRepository } from './repositories/cacheRepository.js';
import {
  RegimeAssessment,
  Alert,
  RebalancingOutput,
  PipelineOutput,
  RegimeQuadrant
} from '../types/index.js';
import { logger } from '../utils/logger.js';

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
  public agentRuns: AgentRunRepository;
  public regimeHistory: RegimeHistoryRepository;
  public alertsSent: AlertsRepository;
  public decisionLog: DecisionRepository;
  public cache: CacheRepository;

  constructor() {
    initSchemas(dbConnection);
    this.agentRuns = new AgentRunRepository(dbConnection);
    this.regimeHistory = new RegimeHistoryRepository(dbConnection);
    this.alertsSent = new AlertsRepository(dbConnection);
    this.decisionLog = new DecisionRepository(dbConnection);
    this.cache = new CacheRepository(dbConnection);
  }

  // Cache Helpers
  public getCache<T>(key: string): T | null {
    return this.cache.get<T>(key);
  }

  public setCache<T>(key: string, value: T): void {
    return this.cache.set<T>(key, value);
  }

  public deleteCache(key: string): void {
    return this.cache.delete(key);
  }

  // Insert Helpers
  public insertAgentRun(run: AgentRun) {
    return this.agentRuns.insert(run);
  }

  public insertRegimeHistory(assessment: RegimeAssessment & { data_inputs?: Record<string, unknown>; raw_response?: Record<string, unknown> }) {
    return this.regimeHistory.insert(assessment);
  }

  public insertAlert(alert: Alert) {
    return this.alertsSent.insert(alert);
  }

  public insertDecision(decision: DecisionLogEntry) {
    return this.decisionLog.insertDecision(decision);
  }

  public insertRebalancingHistory(output: RebalancingOutput) {
    return this.decisionLog.insertRebalancingHistory(output);
  }

  // Query Helpers
  public getLatestRegime(): RegimeAssessment | null {
    return this.regimeHistory.getLatest();
  }

  public getRegimeHistory(limit: number = 10): RegimeAssessment[] {
    return this.regimeHistory.getHistory(limit);
  }

  public acknowledgeAlert(id: number) {
    return this.alertsSent.acknowledge(id);
  }

  public getAlerts(limit: number = 10): (Alert & { id: number; acknowledged: number })[] {
    return this.alertsSent.getAlerts(limit);
  }

  public clearRegimeHistory() {
    this.regimeHistory.clear();
    this.agentRuns.clear();
  }

  public close() {
    dbConnection.close();
  }
}

export const db = new DatabaseManager();

export interface RegimeEvaluationRecord {
  timestamp: string;
  quadrant: RegimeQuadrant;
  confidence: number;
  inflation_score: number;
  growth_score: number;
  regime_drift_vs_prior: PipelineOutput['regime_drift_vs_prior'];
  data_inputs: Record<string, unknown>;
  raw_response: Record<string, unknown>;
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
      raw_response: evaluation.raw_response,
      requires_human_review: false,
      flag_reasons: [],
      drift_delta: null,
      data_gaps: [],
      normalized_inflation_indicators: [],
      normalized_growth_indicators: [],
      classification_verdict: 'Confirmed-Strong',
      challenge_rationale: null,
      confidence_adjustment: 0,
      key_drivers: [],
      confirming_indicators: [],
      contradicting_indicators: [],
      transition_signal: 'None',
      central_thesis_conflict: 'None',
      debasement_overlay: {
        score: 0,
        signal: 'None',
        indicators: {
          gold_real_rate_divergence: '',
          dxy_trend_vs_yield: '',
          treasury_auction_bid_cover: '',
          foreign_reserve_usd_share: ''
        }
      },
      fastest_path_to_being_wrong: 'Nothing',
      watch_next: [],
      requires_human_review_override: false,
      override_reason: null,
      final_confidence: evaluation.confidence,
      final_human_review: false
    } satisfies RegimeAssessment & { data_inputs: Record<string, unknown>; raw_response: Record<string, unknown> });
  } catch (error) {
    logger.error(error, 'Failed to log regime evaluation');
  }
}

export function logRebalancingDecision(decision: RebalancingOutput & { timestamp: string, raw_response?: unknown }) {
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
  } catch (error) {
    logger.error(error, 'Failed to log rebalancing decision');
  }
}

export function logAlert(alert: Alert) {
  try {
    db.insertAlert(alert);
  } catch (error) {
    logger.error(error, 'Failed to log alert');
  }
}

export function getRecentAlerts(limit: number = 10): (Alert & { id: number; acknowledged: number })[] {
  try {
    return db.getAlerts(limit);
  } catch (error) {
    logger.error(error, 'Failed to get recent alerts');
    return [];
  }
}

export function getRecentEvaluations(limit: number = 10): (RegimeAssessment & { timestamp: string; quadrant: RegimeQuadrant; data_inputs: Record<string, unknown>; raw_response: Record<string, unknown> })[] {
  try {
    return db.getRegimeHistory(limit).map(assessment => {
      const parsed = assessment as RegimeAssessment & { data_inputs?: Record<string, unknown>; raw_response?: Record<string, unknown> };
      return {
        ...parsed,
        timestamp: parsed.assessed_at,
        quadrant: parsed.regime_quadrant,
        data_inputs: parsed.data_inputs || {},
        raw_response: parsed.raw_response || parsed
      };
    });
  } catch (error) {
    logger.error(error, 'Failed to get recent evaluations');
    return [];
  }
}

export function clearEvaluations() {
  try {
    db.clearRegimeHistory();
  } catch (error) {
    logger.error(error, 'Failed to clear evaluations');
  }
}
