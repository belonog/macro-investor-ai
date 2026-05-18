# Update Central Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `src/types/index.ts` to include new schemas for the Regime Agent pipeline architecture.

**Architecture:** We are refactoring the Regime Agent to use a deterministic TypeScript pipeline followed by an LLM-based qualitative validator. This plan updates the central types to support this two-stage process and the merged final assessment.

**Tech Stack:** TypeScript, Zod

---

### Task 1: Update type definitions in src/types/index.ts

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update RegimeQuadrantSchema**
Update `RegimeQuadrantSchema` to include 'Boundary Zone'.

```typescript
export const RegimeQuadrantSchema = z.enum([
  'Goldilocks',
  'Inflationary Boom',
  'Stagflation',
  'Deflationary Recession',
  'Boundary Zone'
]);
```

- [ ] **Step 2: Add PipelineOutputSchema**
Add `PipelineOutputSchema` after `RegimeQuadrantSchema`.

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
  dataGaps:        z.array(z.any()), // Simplified for now, can be refined
  assessedAt:      z.string()
});
```

- [ ] **Step 3: Add LLMResponseSchema**
Add `LLMResponseSchema`.

```typescript
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
```

- [ ] **Step 4: Update RegimeAssessmentSchema and FinalAssessmentSchema**
Redefine `FinalAssessmentSchema` and update `RegimeAssessmentSchema` to be an alias. Replace existing `RegimeAssessmentSchema` and related types.

```typescript
export const FinalAssessmentSchema = PipelineOutputSchema.merge(LLMResponseSchema).extend({
  final_confidence: z.number(),
  final_human_review: z.boolean()
});

export type PipelineOutput = z.infer<typeof PipelineOutputSchema>;
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type FinalAssessment = z.infer<typeof FinalAssessmentSchema>;
export type RegimeAssessment = FinalAssessment; // Alias for compatibility
export const RegimeAssessmentSchema = FinalAssessmentSchema; // Alias for compatibility
```

- [ ] **Step 5: Verify types compile**
Run: `npx tsc --noEmit`
Expected: PASS (or only unrelated errors)

- [ ] **Step 6: Commit**
```bash
git add src/types/index.ts
git commit -m "types: update regime assessment schemas for pipeline architecture"
```
