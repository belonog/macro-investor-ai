/**
 * Piecewise linear normalization to [0, 1].
 *
 * Below neutral → maps [low, neutral] to [0.0, 0.5]
 * Above neutral → maps [neutral, high] to [0.5, 1.0]
 *
 * Clamped at 0.0 and 1.0.
 */
export function normalize(value: number, bounds: { low: number, neutral: number, high: number }): number {
  const { low, neutral, high } = bounds;
  if (value <= low)     return 0.0;
  if (value >= high)    return 1.0;
  if (value <= neutral) return 0.5 * (value - low) / (neutral - low);
  return 0.5 + 0.5 * (value - neutral) / (high - neutral);
}

/**
 * Handle missing indicators by redistributing their weight proportionally 
 * to remaining indicators in the same category.
 */
export function redistributeWeights(
  weights: Record<string, number>,
  indicators: Record<string, number>
) {
  const gaps: Array<{
    indicator: string;
    originalWeight: number;
    weightRedistributedTo: string[];
  }> = [];
  const excluded = new Set<string>();

  // Identify excluded indicators
  for (const key of Object.keys(weights)) {
    if (indicators[key] === undefined || indicators[key] === null) {
      gaps.push({
        indicator: key,
        originalWeight: weights[key],
        weightRedistributedTo: [],
      });
      excluded.add(key);
    }
  }

  const availableKeys = Object.keys(weights).filter(k => !excluded.has(k));
  const availableWeightTotal = availableKeys.reduce((s, k) => s + weights[k], 0);

  // Proportional redistribution
  const effectiveWeights: Record<string, number> = {};
  for (const key of availableKeys) {
    effectiveWeights[key] = availableWeightTotal > 0
      ? weights[key] / availableWeightTotal
      : 0;
  }

  // Record redistribution targets in gaps
  for (const gap of gaps) {
    gap.weightRedistributedTo = availableKeys;
  }

  return { effectiveWeights, gaps };
}
