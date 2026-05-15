import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ManualIndicator, ManualIndicatorSchema } from '../types/index.js';

const CACHE_DIR = path.join(process.cwd(), 'src/data/cache');
const CACHE_FILE = path.join(CACHE_DIR, 'manual_indicators.json');

export function getManualIndicators(): Record<string, ManualIndicator> {
  if (!fs.existsSync(CACHE_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return z.record(z.string(), ManualIndicatorSchema).parse(parsed);
  } catch (error) {
    console.error('Error reading manual indicators:', error);
    return {};
  }
}

export function setManualIndicator(key: string, value: ManualIndicator): void {
  const indicators = getManualIndicators();
  indicators[key] = value;
  
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  fs.writeFileSync(CACHE_FILE, JSON.stringify(indicators, null, 2));
}
