# Regime Pipeline Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the deterministic quantitative pipeline for macro regime classification, including indicator normalization, weight redistribution for missing data, and quadrant scoring.

**Architecture:** A pure functional pipeline in `src/agents/regimePipeline.ts` that takes macro indicators and prior assessment as input, applying piecewise linear normalization and category-weighted scoring based on a JSON configuration.

**Tech Stack:** TypeScript, Vitest, Zod

---

### Task 1: Configuration and Type Setup

**Files:**
- Create: `config/regime_pipeline.json`
- Modify: `src/types/index.ts` (if needed for audit trail support)

- [ ] **Step 1: Create `config/regime_pipeline.json`**
Populate with bounds and weights from `macro_investor_ai_specs_v3.md`.

- [ ] **Step 2: Update `src/types/index.ts` to include `PipelineConfig` schema**
Ensure we have a schema to validate the config file.

- [ ] **Step 3: Commit setup**
```bash
git add config/regime_pipeline.json src/types/index.ts
git commit -m "chore: add regime pipeline config and types"
```

### Task 2: Implement Normalization and Utility Logic

**Files:**
- Create: `src/agents/regimePipeline.ts`
- Test: `tests/regimePipeline.test.ts`

- [ ] **Step 1: Write normalization tests**
Test piecewise linear normalization.

- [ ] **Step 2: Implement `normalize` function**

- [ ] **Step 3: Run tests and verify**
Run: `npx vitest tests/regimePipeline.test.ts`

- [ ] **Step 4: Implement `redistributeWeights` logic**
Handle missing indicators by redistributing their weight proportionally to remaining indicators in the same category.

- [ ] **Step 5: Write tests for weight redistribution**

- [ ] **Step 6: Commit utilities**
```bash
git add src/agents/regimePipeline.ts tests/regimePipeline.test.ts
git commit -m "feat: implement normalization and weight redistribution"
```

### Task 3: Implement Core Pipeline Logic

**Files:**
- Modify: `src/agents/regimePipeline.ts`
- Test: `tests/regimePipeline.test.ts`

- [ ] **Step 1: Implement `classifyQuadrant`**
Implement the 4-quadrant logic + Boundary Zone.

- [ ] **Step 2: Implement `detectDrift`**
Detect Stable, Weakening, Transitioning, Shifted based on score changes and threshold crossings.

- [ ] **Step 3: Implement `computeConfidence`**
Apply penalties for missing data, boundary proximity, and regime shifts.

- [ ] **Step 4: Implement main `runPipeline` function**
Orchestrate the above steps to produce `PipelineOutput`.

- [ ] **Step 5: Write comprehensive integration tests**
Test with various macro snapshots and prior assessments.

- [ ] **Step 6: Run all tests and verify**
Run: `npx vitest tests/regimePipeline.test.ts`

- [ ] **Step 7: Final commit**
```bash
git add src/agents/regimePipeline.ts tests/regimePipeline.test.ts
git commit -m "feat: complete regime pipeline implementation"
```
