import { MacroIndicators, MacroCacheSchema } from '../types/index.js';
import { deriveMetrics } from './indicators/derivation.js';
import { logger } from '../utils/logger.js';
import { db } from '../db/database.js';

/**
 * Derives the latest macro indicators from the shared 'macro_snapshot' SQLite cache.
 *
 * The cache is written by four sequential updateMacroCache() calls in runRegimeCycle
 * (fred → bls → eia → polygon). This function is source-agnostic: it reads whatever
 * is currently in the cache, regardless of which fetcher(s) populated it.
 *
 * Returns {} if the cache is absent or unparseable — callers should treat an empty
 * result as a signal that the cache needs warming (via runRegimeCycle), NOT trigger
 * a single-fetcher re-fetch which would produce an incomplete snapshot.
 *
 * @returns Promise<MacroIndicators>
 */
export async function getLatestValues(): Promise<MacroIndicators> {
  try {
    const rawCache = db.getCache<unknown>('macro_snapshot');
    if (!rawCache) {
      logger.error('macro_snapshot cache is empty — run the regime cycle first to warm the cache');
      return {};
    }

    const parsed = MacroCacheSchema.safeParse(rawCache);
    if (!parsed.success) {
      logger.error({ errors: parsed.error.issues }, 'macro_snapshot cache failed schema validation — cache may be corrupt');
      return {};
    }

    return deriveMetrics(parsed.data.data, new Date().toISOString());
  } catch (err) {
    logger.error(err, 'Unexpected error reading macro_snapshot cache');
    return {};
  }
}
