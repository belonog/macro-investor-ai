# Fix Casing and Architectural Inconsistencies in Regime Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize on camelCase for the regime pipeline output and ensure correct mapping of prior assessments (which remain snake_case for database compatibility).

**Architecture:** Update TypeScript types to use consistent camelCase for `PipelineOutputSchema`. Update the regime pipeline implementation to use these new names and ensure `detectDrift` correctly maps fields from the snake_case `PriorAssessment`. Update the database manager to bridge camelCase objects to snake_case database columns.

**Tech Stack:** TypeScript, Zod, Better-SQLite3

---

### Task 1: Update `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update `PipelineOutputSchema` to camelCase**
  Change `normalized_inflation` to `normalizedInflationIndicators` and `normalized_growth` to `normalizedGrowthIndicators`.

```typescript
export const PipelineOutputSchema = z.object({
  inflationScore:  z.number(),
  growthScore:     z.number(),
  regimeQuadrant:  RegimeQuadrantSchema,
  confidence:      z.number(),
  requiresHumanReview: z.boolean(),
  flagReasons:     z.array(z.string()),
  regimeDriftVsPrior: z.enum(['Stable', 'Weakening', 'Transitioning', 'Shifted', 'N/A']),
  driftDelta:      z.object({ inflation: z.number(), growth: z.number() }).nullable(),
  dataGaps:        z.array(DataGapSchema),
  normalizedInflationIndicators: z.array(NormalizedIndicatorSchema),
  normalizedGrowthIndicators:    z.array(NormalizedIndicatorSchema),
  assessedAt:      z.string()
});
```

- [ ] **Step 2: Update `LLMResponseSchema` and `FinalAssessmentSchema` to camelCase**
  For consistency, update `LLMResponseSchema` and `FinalAssessmentSchema` fields to camelCase as well. This avoids a mix of styles in the final record.

```typescript
export const LLMResponseSchema = z.object({
  classificationVerdict:       z.enum(['Confirmed', 'Challenged', 'Nuanced']),
  challengeRationale:          z.string().nullable(),
  confidenceAdjustment:        z.number(),
  keyDrivers:                  z.array(z.string()),
  confirmingIndicators:        z.array(z.any()),
  contradictingIndicators:     z.array(z.any()),
  transitionSignal:            z.string(),
  centralThesisConflict:       z.string(),
  petrodollarRisk:             z.enum(['Active Risk', 'Latent Risk', 'Not Evidenced']),
  petrodollarRationale:        z.string(),
  fastestPathToBeingWrong:     z.string(),
  watchNext:                   z.array(z.any()),
  requiresHumanReviewOverride: z.boolean(),
  overrideReason:              z.string().nullable()
});

export const FinalAssessmentSchema = PipelineOutputSchema.merge(LLMResponseSchema).extend({
  finalConfidence: z.number(),
  finalHumanReview: z.boolean()
});
```

- [ ] **Step 3: Keep `PriorAssessmentSchema` as snake_case**
  Ensure `PriorAssessmentSchema` remains as is, using snake_case.

### Task 2: Update `src/agents/regimePipeline.ts`

**Files:**
- Modify: `src/agents/regimePipeline.ts`

- [ ] **Step 1: Update `runPipeline` return object**
  Update the returned object to use `normalizedInflationIndicators` and `normalizedGrowthIndicators`.

- [ ] **Step 2: Update `detectDrift` mapping**
  Verify it correctly uses `prior.inflation_score`, `prior.growth_score`, and `prior.regime_quadrant`.

- [ ] **Step 3: Update `buildLLMInput`**
  Update the `quantitative_assessment` object to use camelCase internally OR map to what the LLM expects (if the LLM expects snake_case, map it there). The artifact showed snake_case in `buildLLMInput`.

```typescript
    quantitative_assessment: {
      regimeQuadrant:        pipelineOutput.regimeQuadrant,
      inflationScore:        pipelineOutput.inflationScore,
      growthScore:           pipelineOutput.growthScore,
      confidence:            pipelineOutput.confidence,
      regimeDriftVsPrior:    pipelineOutput.regimeDriftVsPrior,
      driftDelta:            pipelineOutput.driftDelta,
      requiresHumanReview:   pipelineOutput.requiresHumanReview,
      flagReasons:           pipelineOutput.flagReasons,
      dataGaps:              pipelineOutput.dataGaps,
      normalizedInflation:   pipelineOutput.normalizedInflationIndicators,
      normalizedGrowth:      pipelineOutput.normalizedGrowthIndicators,
    },
```
Wait, I'll use the names the LLM prompt expects. If the prompt uses snake_case, I should map them.

- [ ] **Step 4: Update `mergePipelineAndLLM`**
  Update to use camelCase fields from `LLMResponse`.

### Task 3: Update `src/db/database.ts`

**Files:**
- Modify: `src/db/database.ts`

- [ ] **Step 1: Update `insertRegimeHistory`**
  Map camelCase fields from the assessment object to the snake_case database columns.

```typescript
    return stmt.run(
      assessment.regimeQuadrant,
      assessment.confidence,
      assessment.inflationScore !== undefined ? assessment.inflationScore : null,
      assessment.growthScore !== undefined ? assessment.growthScore : null,
      assessment.regimeDriftVsPrior || null,
      JSON.stringify(assessment),
      assessment.assessedAt || null
    );
```

### Task 4: Verification

- [ ] **Step 1: Update tests to match new casing**
  Modify `tests/regimePipeline.test.ts` to expect camelCase.

- [ ] **Step 2: Run all tests**
  Command: `npm test`
  Expected: All tests pass.

- [ ] **Step 3: Commit changes**
  Command: `git commit -m "fix: resolve regime pipeline casing inconsistencies"`
