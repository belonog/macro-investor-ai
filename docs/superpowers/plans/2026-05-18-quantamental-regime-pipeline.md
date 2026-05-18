# Quantamental Regime Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition the Regime Agent from a direct LLM-based classification to a two-layer "Quantamental" system: a deterministic TypeScript pipeline for scoring/classification followed by an LLM-based qualitative validator.

**Architecture:** 
1. **Deterministic Pipeline**: A pure TypeScript module (`regimePipeline.ts`) that handles indicator normalization (piecewise linear), weight redistribution (missing data handling), and quadrant classification based on fixed thresholds.
2. **Qualitative Validator**: The `regimeAgent.ts` is refactored to first run the pipeline, then pass the structured `PipelineOutput` to the LLM for high-level reasoning, contradiction detection, and thesis assessment.
3. **Unified Types**: Centralized schemas in `src/types/index.ts` to ensure type safety across the pipeline and LLM layers.

**Tech Stack:** TypeScript, Zod, Vitest.

---

### Task 1: Update Central Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update type definitions**
Update `src/types/index.ts` to include `PipelineOutputSchema`, `LLMResponseSchema`, and the updated `RegimeAssessmentSchema` (which is the final merged assessment).

```typescript
// src/types/index.ts

export const RegimeQuadrantSchema = z.enum([
  'Goldilocks',
  'Inflationary Boom',
  'Stagflation',
  'Deflationary Recession',
  'Boundary Zone'
]);

export const PipelineOutputSchema = z.object({
  inflationScore:  z.number(),
  growthScore:     z.number(),
  regimeQuadrant:  RegimeQuadrantSchema,
  confidence:      z.number(),
  requiresHumanReview: z.boolean(),
  flagReasons:     z.array(z.string()),
  regimeDriftVsPrior: z.enum(['Stable', 'Weakening', 'Transitioning', 'Shifted', 'N/A']),
  driftDelta:      z.object({ inflation: z.number(), growth: z.number() }).nullable(),
  dataGaps:        z.array(z.any()), // Simplified for now, can be refined
  assessedAt:      z.string()
});

export const LLMResponseSchema = z.object({
  classification_verdict:       z.enum(['Confirmed', 'Challenged', 'Nuanced']),
  challenge_rationale:          z.string().nullable(),
  confidence_adjustment:        z.number(),
  key_drivers:                  z.array(z.string()),
  confirming_indicators:        z.array(z.any()),
  contradicting_indicators:     z.array(z.any()),
  transition_signal:            z.string(),
  central_thesis_conflict:      z.string(),
  petrodollar_risk:             z.enum(['Active Risk', 'Latent Risk', 'Not Evidenced']),
  petrodollar_rationale:        z.string(),
  fastest_path_to_being_wrong:  z.string(),
  watch_next:                   z.array(z.any()),
  requires_human_review_override: z.boolean(),
  override_reason:              z.string().nullable()
});

export const FinalAssessmentSchema = PipelineOutputSchema.merge(LLMResponseSchema).extend({
  final_confidence: z.number(),
  final_human_review: z.boolean()
});

export type PipelineOutput = z.infer<typeof PipelineOutputSchema>;
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type FinalAssessment = z.infer<typeof FinalAssessmentSchema>;
export type RegimeAssessment = FinalAssessment; // Alias for compatibility
```

- [ ] **Step 2: Verify types compile**
Run: `npx tsc --noEmit`
Expected: PASS (or only unrelated errors)

- [ ] **Step 3: Commit**
```bash
git add src/types/index.ts
git commit -m "types: update regime assessment schemas for pipeline architecture"
```

---

### Task 2: Create Regime Pipeline Logic

**Files:**
- Create: `src/agents/regimePipeline.ts`
- Create: `tests/regimePipeline.test.ts`
- Create: `config/regime_pipeline.json`

- [ ] **Step 1: Create pipeline config**
Create `config/regime_pipeline.json` with the bounds and weights from the spec.

- [ ] **Step 2: Implement normalization and redistribution logic**
Implement `normalize(value, bounds)` (piecewise linear) and `redistributeWeights(weights, indicators)` in `src/agents/regimePipeline.ts`.

- [ ] **Step 3: Implement core `runPipeline` function**
Implement the logic to score inflation/growth, classify quadrant, and detect drift vs. prior.

- [ ] **Step 4: Write unit tests**
Test normalization, weight redistribution (with missing indicators), and quadrant classification.

```typescript
// tests/regimePipeline.test.ts
import { runPipeline } from '../src/agents/regimePipeline';
// ... test cases for Stagflation, Goldilocks, and Boundary Zone
```

- [ ] **Step 5: Run tests**
Run: `npx vitest tests/regimePipeline.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add config/regime_pipeline.json src/agents/regimePipeline.ts tests/regimePipeline.test.ts
git commit -m "feat: implement deterministic regime pipeline"
```

---

### Task 3: Refactor Regime Agent

**Files:**
- Modify: `src/agents/regimeAgent.ts`
- Modify: `src/prompts/regime_system.txt`

- [ ] **Step 1: Update system prompt**
Replace `src/prompts/regime_system.txt` with the new validator-focused prompt.

- [ ] **Step 2: Refactor `runRegimeAgent`**
Update the function to:
1. Call `runPipeline(input)`.
2. Build the LLM payload (PipelineOutput + raw indicators).
3. Call the LLM using the new validator prompt.
4. Merge results using a `mergePipelineAndLLM` utility.

- [ ] **Step 3: Update `RegimeAgentInput` type**
Ensure it accepts the `regimePipeline` config and `positionsConfig`.

- [ ] **Step 4: Verify integration tests**
Run: `npx vitest tests/regimeAgent.test.ts`
Expected: PASS (may require updating mocks/fixtures)

- [ ] **Step 5: Commit**
```bash
git add src/agents/regimeAgent.ts src/prompts/regime_system.txt tests/regimeAgent.test.ts
git commit -m "feat: refactor regimeAgent to use quantamental pipeline"
```

---

### Task 4: Update Flows and CLI

**Files:**
- Modify: `src/flows/regimeCycle.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Update `regimeCycle.ts`**
Load `regime_pipeline.json` instead of `regime_weights.json` and pass it to the agent. Update data mapping for YoY% indicators.

- [ ] **Step 2: Update CLI commands**
Update `npx tsx src/cli.ts regime` and other related commands to use the new config path.

- [ ] **Step 3: Final End-to-End Verification**
Run a dry run of the regime cycle.
Run: `npx tsx src/cli.ts regime --trigger manual` (with appropriate mocks/env)

- [ ] **Step 4: Commit**
```bash
git add src/flows/regimeCycle.ts src/cli.ts
git commit -m "chore: update flows and CLI for new regime pipeline"
```
