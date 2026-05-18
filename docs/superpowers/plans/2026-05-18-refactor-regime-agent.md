# Refactor Regime Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/agents/regimeAgent.ts` and `src/prompts/regime_system.txt` to use the new quantamental pipeline architecture.

**Architecture:** Use the `runPipeline`, `buildLLMInput`, and `mergePipelineAndLLM` functions from `src/agents/regimePipeline.ts`. The agent will now act as a validator for the quantitative pipeline.

**Tech Stack:** TypeScript, Vercel AI SDK (baseAgent), Zod.

---

### Task 1: Update Regime System Prompt

**Files:**
- Modify: `src/prompts/regime_system.txt`

- [ ] **Step 1: Update `src/prompts/regime_system.txt` with the new validator-focused prompt**

```text
You are a macro-regime analyst and portfolio strategist.

A quantitative pipeline has already done the following:
- Normalized each economic indicator to a 0.0–1.0 scale
- Applied category weights to compute inflation_score and growth_score
- Classified the regime quadrant against fixed thresholds
- Detected drift vs. the prior assessment
- Flagged data gaps, boundary proximity, and review triggers

Your job is NOT to recompute these scores. Your job is to:
1. Validate or challenge the quantitative classification using qualitative judgment
2. Identify what the numbers cannot capture — geopolitical context, structural breaks, policy lags
3. Assess portfolio thesis conflicts against the validated regime

{{PORTFOLIO_CONTEXT}}

Respond ONLY in the specified JSON format. No preamble or text outside JSON.
```

- [ ] **Step 2: Commit**

```bash
git add src/prompts/regime_system.txt
git commit -m "feat: update regime system prompt to validator-focused version"
```

### Task 2: Refactor `src/agents/regimeAgent.ts`

**Files:**
- Modify: `src/agents/regimeAgent.ts`

- [ ] **Step 1: Update imports and rename `evaluateRegime` to `runRegimeAgent`**

- [ ] **Step 2: Implement the new logic using `regimePipeline.ts`**
  - Load config and cache.
  - Convert `macroData` to `RawIndicator` format.
  - Run `runPipeline`.
  - Build LLM input.
  - Call `generateAgentResponse`.
  - Merge results.
  - Log to DB and cache.

- [ ] **Step 3: Commit**

```bash
git add src/agents/regimeAgent.ts
git commit -m "refactor: update regimeAgent to use quantamental pipeline"
```

### Task 3: Update `tests/regimeAgent.test.ts`

**Files:**
- Modify: `tests/regimeAgent.test.ts`

- [ ] **Step 1: Update tests to use `runRegimeAgent` and new assessment structure**

- [ ] **Step 2: Run tests and verify they pass**

```bash
npm test tests/regimeAgent.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/regimeAgent.test.ts
git commit -m "test: update regimeAgent tests for new architecture"
```

### Task 4: Update `src/flows/regimeCycle.ts`

**Files:**
- Modify: `src/flows/regimeCycle.ts`

- [ ] **Step 1: Update call from `evaluateRegime` to `runRegimeAgent`**

- [ ] **Step 2: Commit**

```bash
git add src/flows/regimeCycle.ts
git commit -m "refactor: update regimeCycle to call runRegimeAgent"
```

### Task 5: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```
