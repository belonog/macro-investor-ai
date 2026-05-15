import { describe, it, expect, beforeEach } from 'vitest';
import { dbManager } from '../src/agents/db.js';
import { RegimeEvaluationRecord } from '../src/agents/db.js';

describe('DatabaseManager', () => {
  beforeEach(() => {
    dbManager.clearEvaluations();
  });

  it('should log a regime evaluation and retrieve it', () => {
    const evaluation: RegimeEvaluationRecord = {
      timestamp: new Date().toISOString(),
      quadrant: 'Goldilocks',
      confidence: 85,
      data_inputs: { inflation: 2.1, growth: 2.5 },
      raw_response: { full_text: 'The economy is in a goldilocks state.' }
    };

    dbManager.logRegimeEvaluation(evaluation);

    const recent = dbManager.getRecentEvaluations(1);
    expect(recent.length).toBe(1);
    expect(recent[0].quadrant).toBe(evaluation.quadrant);
    expect(recent[0].confidence).toBe(evaluation.confidence);
    expect(recent[0].data_inputs).toEqual(evaluation.data_inputs);
    expect(recent[0].raw_response).toEqual(evaluation.raw_response);
  });

  it('should retrieve multiple evaluations in correct order', () => {
    const eval1: RegimeEvaluationRecord = {
      timestamp: '2023-01-01T12:00:00Z',
      quadrant: 'Goldilocks',
      confidence: 80,
      data_inputs: {},
      raw_response: {}
    };
    const eval2: RegimeEvaluationRecord = {
      timestamp: '2023-01-02T12:00:00Z',
      quadrant: 'Stagflation',
      confidence: 70,
      data_inputs: {},
      raw_response: {}
    };

    dbManager.logRegimeEvaluation(eval1);
    dbManager.logRegimeEvaluation(eval2);

    const recent = dbManager.getRecentEvaluations(10);
    // eval2 should be first because it has a later timestamp and we ORDER BY timestamp DESC
    expect(recent[0].timestamp).toBe(eval2.timestamp);
    expect(recent[1].timestamp).toBe(eval1.timestamp);
  });

  it('should log an alert and retrieve it', () => {
    const alert = {
      level: 'CRITICAL',
      symbol: 'AAPL',
      message: 'Significant price drop',
      action: 'Check position'
    };

    dbManager.logAlert(alert);

    const recent = dbManager.getRecentAlerts(1);
    expect(recent.length).toBe(1);
    expect(recent[0].level).toBe(alert.level);
    expect(recent[0].symbol).toBe(alert.symbol);
    expect(recent[0].message).toBe(alert.message);
  });
});
