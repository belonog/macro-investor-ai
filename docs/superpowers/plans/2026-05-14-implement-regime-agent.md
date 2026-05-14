# Regime Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Regime Agent that analyzes macro data using Gemini 2.0 Flash and persists the results.

**Architecture:** The `regimeAgent.ts` will load a system prompt, call the Gemini API with macro data, parse the JSON response, validate it with Zod, and save it to both SQLite (via `dbManager`) and a local JSON cache.

**Tech Stack:** TypeScript, `@google/genai`, `zod`, `better-sqlite3`, `vitest`.

---

### Task 1: Basic Structure and evaluateRegime interface

**Files:**
- Create: `src/agents/regimeAgent.ts`
- Test: `tests/regimeAgent.test.ts`

- [ ] **Step 1: Write the failing test for evaluateRegime**
  We want to test that `evaluateRegime` exists and can be called.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { evaluateRegime } from '../src/agents/regimeAgent';

describe('regimeAgent', () => {
  it('should define evaluateRegime function', () => {
    expect(evaluateRegime).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest tests/regimeAgent.test.ts`
  Expected: FAIL with "evaluateRegime is not defined" (since file doesn't exist)

- [ ] **Step 3: Write minimal implementation**

```typescript
import { MacroSnapshot, RegimeSnapshot } from '../data/types';

export async function evaluateRegime(macroData: Record<string, number>): Promise<RegimeSnapshot> {
  throw new Error('Not implemented');
}
```

- [ ] **Step 4: Run test to verify it passes (or fails with "Not implemented")**
  Run: `pnpm vitest tests/regimeAgent.test.ts`
  Expected: PASS for "should define evaluateRegime function"

- [ ] **Step 5: Commit**
```bash
git add src/agents/regimeAgent.ts tests/regimeAgent.test.ts
git commit -m "feat: initial regimeAgent structure"
```

---

### Task 2: Implement Gemini Integration and Validation

**Files:**
- Modify: `src/agents/regimeAgent.ts`
- Modify: `tests/regimeAgent.test.ts`

- [ ] **Step 1: Write failing test for successful Gemini call**
  Mock `@google/genai` and `fs` to simulate a successful API call.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest tests/regimeAgent.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement evaluateRegime with Gemini and Zod**
  - Read prompt from `src/prompts/regime_system.txt`.
  - Use `GoogleGenAI` to call `gemini-2.0-flash`.
  - Validate output with `RegimeSnapshotSchema`.
  - Add `evaluatedAt` to the response.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest tests/regimeAgent.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/agents/regimeAgent.ts tests/regimeAgent.test.ts
git commit -m "feat: implement Gemini integration in evaluateRegime"
```

---

### Task 3: Implement Persistence and Caching

**Files:**
- Modify: `src/agents/regimeAgent.ts`
- Modify: `tests/regimeAgent.test.ts`

- [ ] **Step 1: Write failing test for persistence**
  Verify that `dbManager.logRegimeEvaluation` is called and cache file is written.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest tests/regimeAgent.test.ts`

- [ ] **Step 3: Implement persistence and caching**
  - Call `dbManager.logRegimeEvaluation`.
  - Write to `data/cache/regime_latest.json`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest tests/regimeAgent.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/agents/regimeAgent.ts tests/regimeAgent.test.ts
git commit -m "feat: add persistence and caching to regime agent"
```
