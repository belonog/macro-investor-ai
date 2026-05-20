import fs from 'fs';
import { z } from 'zod';
import { ManualIndicator, ManualIndicatorSchema } from '../types/index.js';
import { CACHE_DIR, MANUAL_INDICATORS_CACHE_PATH } from '../config/paths.js';
import { logger } from '../utils/logger.js';

export function getManualIndicators(): Record<string, ManualIndicator> {
  if (!fs.existsSync(MANUAL_INDICATORS_CACHE_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(MANUAL_INDICATORS_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return z.record(z.string(), ManualIndicatorSchema).parse(parsed);
  } catch (error) {
    logger.error(error, 'Error reading manual indicators');
    return {};
  }
}

export function setManualIndicator(key: string, value: ManualIndicator): void {
  const indicators = getManualIndicators();
  indicators[key] = value;
  
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  fs.writeFileSync(MANUAL_INDICATORS_CACHE_PATH, JSON.stringify(indicators, null, 2));
}
