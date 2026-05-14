import { RegimeSnapshot } from '../data/types';

/**
 * Evaluates the current economic regime based on macro data.
 * @param macroData A record of macro indicator names and their values.
 * @returns A promise that resolves to a RegimeSnapshot.
 */
export async function evaluateRegime(macroData: Record<string, number>): Promise<RegimeSnapshot> {
  throw new Error('Not implemented');
}
