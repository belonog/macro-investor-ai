# Global CamelCase to Snake_Case Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all camelCase field names to snake_case in accordance with the newly updated Zod schemas in `src/types/index.ts`.

**Architecture:** Use `grep_search` and `replace` to systematically update all occurrences in `tests/`, `examples/`, and `src/`.

**Tech Stack:** TypeScript, Vitest, Zod

---

## File Structure Changes
- No new files.
- Many existing files in `src/`, `tests/`, and `examples/` will be modified.

## Migration Mapping
- `inflationScore` -> `inflation_score`
- `growthScore` -> `growth_score`
- `regimeQuadrant` -> `regime_quadrant`
- `requiresHumanReview` -> `requires_human_review`
- `flagReasons` -> `flag_reasons`
- `regimeDriftVsPrior` -> `regime_drift_vs_prior`
- `driftDelta` -> `drift_delta`
- `dataGaps` -> `data_gaps`
- `normalizedInflationIndicators` -> `normalized_inflation_indicators`
- `normalizedGrowthIndicators` -> `normalized_growth_indicators`
- `assessedAt` -> `assessed_at`
- `classificationVerdict` -> `classification_verdict`
- `challengeRationale` -> `challenge_rationale`
- `confidenceAdjustment` -> `confidence_adjustment`
- `keyDrivers` -> `key_drivers`
- `confirmingIndicators` -> `confirming_indicators`
- `contradictingIndicators` -> `contradicting_indicators`
- `transitionSignal` -> `transition_signal`
- `centralThesisConflict` -> `central_thesis_conflict`
- `petrodollarRisk` -> `petrodollar_risk`
- `petrodollarRationale` -> `petrodollar_rationale`
- `fastestPathToBeingWrong` -> `fastest_path_to_being_wrong`
- `watchNext` -> `watch_next`
- `requiresHumanReviewOverride` -> `requires_human_review_override`
- `overrideReason` -> `override_reason`
- `finalConfidence` -> `final_confidence`
- `finalHumanReview` -> `final_human_review`
- `regimeMatch` -> `regime_match`
- `correlationRisk` -> `correlation_risk`
- `thesisConflicts` -> `thesis_conflicts`
- `sizingNote` -> `sizing_note`
- `questionsBeforeEntry` -> `questions_before_entry`
- `avgCost` -> `avg_cost`
- `marketPrice` -> `market_price`
- `marketValue` -> `market_value`
- `unrealizedPnl` -> `unrealized_pnl`
- `unrealizedPnlPct` -> `unrealized_pnl_pct`
- `fetchedAt` -> `fetched_at`
- `createdAt` -> `created_at`
- `currentTime` -> `current_time`
- `priorAssessment` -> `prior_assessment`
- `portfolioContext` -> `portfolio_context`
- `rawValue` -> `raw_value`
- `normalizedScore` -> `normalized_score`
- `effectiveWeight` -> `effective_weight`
- `originalWeight` -> `original_weight`
- `weightedContribution` -> `weighted_contribution`
- `weightRedistributedTo` -> `weight_redistributed_to`
- `updatedAt` -> `updated_at`
- `reportDate` -> `report_date`
- `epsEstimate` -> `eps_estimate`
- `timeOfDay` -> `time_of_day`

**Special Case:**
- `regime_portfolio_alignment_score` -> `alignment_score`

---

### Task 1: Refactor `src/` directory

- [ ] **Step 1: Update `src/agents/regimeAgent.ts`**
- [ ] **Step 2: Update `src/agents/regimePipeline.ts`**
- [ ] **Step 3: Update `src/db/database.ts`**
- [ ] **Step 4: Search for any other missed occurrences in `src/`**

### Task 2: Refactor `tests/` directory

- [ ] **Step 1: Update `tests/dailyDigest.test.ts`**
- [ ] **Step 2: Update `tests/regimeAgent.test.ts`**
- [ ] **Step 3: Update `tests/regimePipeline.test.ts`**
- [ ] **Step 4: Update `tests/types.test.ts`**
- [ ] **Step 5: Search and update all other files in `tests/`**

### Task 3: Refactor `examples/` directory

- [ ] **Step 1: Update `examples/backtest_regime_engine.ts`**
- [ ] **Step 2: Update `examples/run_regime_check.ts`**
- [ ] **Step 3: Update `examples/system_status_report.ts`**

### Task 4: Verification

- [ ] **Step 1: Run tests**
- [ ] **Step 2: Fix any remaining issues**
