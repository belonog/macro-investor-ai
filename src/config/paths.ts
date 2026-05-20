import path from 'node:path';

const ROOT = process.cwd();

/**
 * Project-wide path constants to ensure consistency across modules.
 * All paths are absolute based on the current working directory.
 */

// Core Directories
export const CONFIG_DIR = path.join(ROOT, 'config');
export const SRC_DIR = path.join(ROOT, 'src');
export const DATA_DIR = path.join(SRC_DIR, 'data');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const PROMPTS_DIR = path.join(SRC_DIR, 'prompts');
export const LOGS_DIR = path.join(ROOT, 'logs');

// Config Files
export const POSITIONS_CONFIG_PATH = path.join(CONFIG_DIR, 'positions.json');
export const REGIME_PIPELINE_CONFIG_PATH = path.join(CONFIG_DIR, 'regime_pipeline.json');

// Cache Files
export const MACRO_SNAPSHOT_CACHE_PATH = path.join(CACHE_DIR, 'macroSnapshot.json');
export const REGIME_CACHE_PATH = path.join(CACHE_DIR, 'regime_latest.json');
export const POSITIONS_CACHE_PATH = path.join(CACHE_DIR, 'positions_snapshot.json');
export const REBALANCING_CACHE_PATH = path.join(CACHE_DIR, 'rebalancingLatest.json');
export const MANUAL_INDICATORS_CACHE_PATH = path.join(CACHE_DIR, 'manual_indicators.json');

// Database
export const DB_PATH = path.join(LOGS_DIR, 'macro_investor.db');

// Prompts
export const REGIME_PROMPT_PATH = path.join(PROMPTS_DIR, 'regime_system.txt');
export const REBALANCING_PROMPT_PATH = path.join(PROMPTS_DIR, 'rebalancing_system.txt');
export const COHERENCE_PROMPT_PATH = path.join(PROMPTS_DIR, 'coherence_system.txt');
export const INTERPRETER_PROMPT_PATH = path.join(PROMPTS_DIR, 'interpreter_system.txt');
export const PREBRIEF_PROMPT_PATH = path.join(PROMPTS_DIR, 'prebrief_system.txt');
