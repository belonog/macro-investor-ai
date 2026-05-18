# Fix Casing and Typos in Tests and Flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct snake_case vs camelCase inconsistencies and typos in `tests/regimePipeline.test.ts`, `tests/regimeAgent.test.ts`, and `src/flows/regimeCycle.ts` to ensure compatibility with Spec v3 implementation.

**Architecture:** Surgical replacement of outdated property names and typos.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Fix `tests/regimePipeline.test.ts`

**Files:**
- Modify: `tests/regimePipeline.test.ts`

- [ ] **Step 1: Update `mergePipelineAndLLM` test case**
  Replace snake_case properties with camelCase in the test case for `mergePipelineAndLLM`.

- [ ] **Step 2: Scan for other snake_case properties in the file**
  Ensure all `regime_quadrant` (etc) in test mocks are updated if they refer to `PipelineOutput` or `FinalAssessment`.

- [ ] **Step 3: Run tests to verify**
  Run: `npx vitest tests/regimePipeline.test.ts --run`
  Expected: PASS

### Task 2: Fix typo in `tests/regimeAgent.test.ts`

**Files:**
- Modify: `tests/regimeAgent.test.ts`

- [ ] **Step 1: Fix `fastestPathToBeing_wrong` typo**
  Replace `fastestPathToBeing_wrong` with `fastestPathToBeingWrong` in LLM response mocks.

- [ ] **Step 2: Run tests to verify**
  Run: `npx vitest tests/regimeAgent.test.ts --run`
  Expected: PASS

### Task 3: Fix casing in `src/flows/regimeCycle.ts`

**Files:**
- Modify: `src/flows/regimeCycle.ts`

- [ ] **Step 1: Update `regime_drift_vs_prior` and `regime_quadrant`**
  Replace `assessment.regime_drift_vs_prior` with `assessment.regimeDriftVsPrior`.
  Replace `assessment.regime_quadrant` with `assessment.regimeQuadrant`.

- [ ] **Step 2: Verify no other snake_case usage on `assessment`**
  Check `assessment.confidence` vs `assessment.finalConfidence` (FinalAssessment has both, but `finalConfidence` is the validated one).

### Task 4: Final Verification

- [ ] **Step 1: Run all affected tests**
  Run: `npx vitest tests/regimeAgent.test.ts tests/regimePipeline.test.ts tests/eodCheck.test.ts --run`

- [ ] **Step 2: Type check**
  Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**
  ```bash
  git add tests/regimePipeline.test.ts tests/regimeAgent.test.ts src/flows/regimeCycle.ts
  git commit -m "fix: update outdated test fields and flow casing to camelCase"
  ```
