# Implement Regime Agent Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Regime Agent by adding persistence to SQLite, JSON caching, and robust error handling, and update tests to verify these features.

**Architecture:** The `evaluateRegime` function will be enhanced to log every evaluation to the database and update a local JSON cache. It will also include robust error handling for API and file system issues.

**Tech Stack:** TypeScript, Gemini AI API (via `@google/genai`), SQLite (via `better-sqlite3`), Zod (for validation), Vitest (for testing).

---

### Task 1: Complete Regime Agent Implementation

**Files:**
- Modify: `src/agents/regimeAgent.ts`

- [ ] **Step 1: Update imports and add constants**

```typescript
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { RegimeSnapshot, RegimeSnapshotSchema } from '../data/types';
import { dbManager } from './db';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regimeLatest.json');
const PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'regime_system.txt');
```

- [ ] **Step 2: Add validation for API key and prompt file**

Ensure these checks are at the module level or inside `evaluateRegime`.

- [ ] **Step 3: Enhance `evaluateRegime` with persistence, caching, and error handling**

```typescript
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
```

### Task 2: Update and Enhance Tests

**Files:**
- Modify: `tests/regimeAgent.test.ts`

- [ ] **Step 1: Update mocks to include `dbManager` and `fs`**

The current tests already mock `fs` and `dbManager`.

- [ ] **Step 2: Add test case for DB logging and JSON caching**

```typescript
  it('should persist to DB and cache to JSON', async () => {
    const mockMacroData = { inflation: 2.5, growth: 1.5 };
    vi.mocked(fs.readFileSync).mockReturnValue('Mock Prompt');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        quadrant: 'Goldilocks',
        confidence: 85,
        keyDrivers: ['Driver 1'],
        transitionSignal: 'None'
      })
    });

    await evaluateRegime(mockMacroData);

    expect(dbManager.logRegimeEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      quadrant: 'Goldilocks',
      confidence: 85,
      data_inputs: mockMacroData
    }));
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('regimeLatest.json'),
      expect.stringContaining('"quadrant": "Goldilocks"')
    );
  });
```

- [ ] **Step 3: Add test case for error handling (missing API key)**

```typescript
  it('should throw error if GEMINI_API_KEY is missing', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    
    await expect(evaluateRegime({})).rejects.toThrow('GEMINI_API_KEY is not set');
    
    process.env.GEMINI_API_KEY = originalKey;
  });
```

- [ ] **Step 4: Add test case for error handling (missing prompt file)**

```typescript
  it('should throw error if prompt file is missing', async () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('regime_system.txt')) return false;
        return true;
    });
    
    await expect(evaluateRegime({})).rejects.toThrow('System prompt file not found');
  });
```

### Task 3: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npm test tests/regimeAgent.test.ts`
Expected: All tests pass.

- [ ] **Step 2: Manual verification (Optional but recommended)**

If possible, run a small script to call `evaluateRegime` and check `logs/macro_investor.db` and `src/data/cache/regimeLatest.json`.

- [ ] **Step 3: Commit changes**

```bash
git add src/agents/regimeAgent.ts tests/regimeAgent.test.ts
git commit -m "feat: implement regime agent with Gemini integration, persistence and caching"
```
