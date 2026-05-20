import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Supply dummy values for required env variables in test mode to ensure tests run smoothly
if (process.env.NODE_ENV === 'test') {
  process.env.FRED_API_KEY = process.env.FRED_API_KEY || 'mock_fred_key';
  process.env.POLYGON_API_KEY = process.env.POLYGON_API_KEY || 'mock_polygon_key';
  process.env.EIA_API_KEY = process.env.EIA_API_KEY || 'mock_eia_key';
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AI_PROVIDER: z.enum(['google', 'anthropic']).default('google'),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  REGIME_AGENT_MODEL: z.string().optional(),
  REBALANCING_AGENT_MODEL: z.string().optional(),
  COHERENCE_AGENT_MODEL: z.string().optional(),
  INTERPRETER_AGENT_MODEL: z.string().optional(),
  FRED_API_KEY: z.string().min(1, 'FRED_API_KEY is required'),
  POLYGON_API_KEY: z.string().min(1, 'POLYGON_API_KEY is required'),
  EIA_API_KEY: z.string().min(1, 'EIA_API_KEY is required'),
  BLS_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  IBKR_FLEX_TOKEN: z.string().optional(),
  IBKR_FLEX_REPORT_ID: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
}).refine((data) => {
  if (data.AI_PROVIDER === 'google' && !data.GEMINI_API_KEY) {
    return false;
  }
  return true;
}, {
  message: 'GEMINI_API_KEY is required when AI_PROVIDER is set to "google"',
  path: ['GEMINI_API_KEY'],
}).refine((data) => {
  if (data.AI_PROVIDER === 'anthropic' && !data.ANTHROPIC_API_KEY) {
    return false;
  }
  return true;
}, {
  message: 'ANTHROPIC_API_KEY is required when AI_PROVIDER is set to "anthropic"',
  path: ['ANTHROPIC_API_KEY'],
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables Configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
