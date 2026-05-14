import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { RegimeSnapshot, RegimeSnapshotSchema } from '../data/types';
import { dbManager } from './db';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regimeLatest.json');
const WEIGHTS_PATH = path.join(process.cwd(), 'config', 'regime_weights.json');
const PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'regime_system.txt');

/**
 * Evaluates the current economic regime based on macro data.
 * @param macroData A record of macro indicator names and their values.
 * @returns A promise that resolves to a RegimeSnapshot.
 */
export async function evaluateRegime(macroData: Record<string, number>): Promise<RegimeSnapshot> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    if (!fs.existsSync(PROMPT_PATH)) {
      throw new Error(`System prompt file not found at ${PROMPT_PATH}`);
    }

    const systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');

    // Load weights
    const weights = fs.existsSync(WEIGHTS_PATH)
      ? JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'))
      : {};

    // Load prior assessment
    const priorAssessment = fs.existsSync(CACHE_PATH)
      ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
      : null;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const promptContext = {
      macro_indicators: macroData,
      regime_weights: weights,
      prior_assessment: priorAssessment,
    };

    const modelName = process.env.REGIME_AGENT_MODEL || 'gemini-3-flash-preview';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${systemPrompt}\n\nContext:\n${JSON.stringify(promptContext, null, 2)}`,
      config: {
        responseMimeType: 'application/json',
      }
    });


    if (!response.text) {
      throw new Error('Empty response from Gemini API');
    }

    const rawJson = JSON.parse(response.text);
    const evaluatedAt = new Date().toISOString();

    const validated = RegimeSnapshotSchema.parse({
      ...rawJson,
      evaluatedAt,
    });

    // 1. Persist to SQLite
    dbManager.logRegimeEvaluation({
      timestamp: evaluatedAt,
      quadrant: validated.quadrant,
      confidence: validated.confidence,
      data_inputs: macroData,
      raw_response: rawJson,
    });

    // 2. Cache to JSON
    const cacheDir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(validated, null, 2));

    return validated;
  } catch (error) {
    console.error('Error evaluating regime:', error);
    throw error;
  }
}
