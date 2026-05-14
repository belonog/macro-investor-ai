import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { RegimeSnapshot, RegimeSnapshotSchema } from '../data/types';
import { dbManager } from './db';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regimeLatest.json');
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

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${systemPrompt}\n\nData to analyze:\n${JSON.stringify(macroData, null, 2)}`,
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
