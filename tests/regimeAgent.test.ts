import { describe, it, expect, vi } from 'vitest';
import { evaluateRegime } from '../src/agents/regimeAgent';

describe('regimeAgent', () => {
  it('should define evaluateRegime function', () => {
    expect(evaluateRegime).toBeDefined();
  });
});
