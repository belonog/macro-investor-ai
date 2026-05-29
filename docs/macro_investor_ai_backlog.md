# Macro Investor AI System — Improvement Backlog

This document captures the identified architectural vulnerabilities and proposed enhancements for the Macro Investor AI project, prioritized for backlog integration.

## 1. Architecture & Data Reliability

### 1.1 The Macro Data "Revision" Blindspot
* **Issue:** Macroeconomic data (NFP, GDP, CPI) is frequently revised retrospectively. The current caching strategy (`macro_snapshot.json`) calculating trailing trends (e.g., `nfp_3m_avg_k`) by appending only the newest data points will silently drift from reality as government agencies revise past months.
* **Action Item:** Refactor fetchers (`fredFetcher.ts`, `blsFetcher.ts`) to overwrite the entire historical trailing 12-month array on every run, recalculating derived trend fields from the fresh, fully revised dataset.

### 1.2 State Management and Race Conditions
* **Issue:** `positions.json` currently mixes manual configuration (semantic fields like thesis and stops) with automated file updates (quantitative fields like shares and cost updated via `positionsSync.ts`). This creates race conditions and file-locking errors during concurrent human edits and cron execution.
* **Action Item:** Split state storage. Implement `portfolio_state.json` (strictly machine-written by Flex sync) and `portfolio_theses.json` (strictly human-written). Join them in memory within `buildPortfolioContext()`.

### 1.3 Graceful Degradation for Upstream Outages
* **Issue:** Heavy reliance on brittle government APIs (FRED, BLS, EIA). A 503 error blocks `fredFetcher.fetchAll()` and breaks the entire Regime Cycle flow.
* **Action Item:** Implement a "degraded mode" in the fetchers. If an API fetch fails after retries, fallback to the last known cached values, flag the specific missing indicator in the `dataGaps` array, and dynamically inject an instruction into the LLM prompt to assess the regime assuming the specific indicator is currently unavailable.

## 2. Agent & LLM Optimization

### 2.1 Pre-compute Rebalancing Math (LLM Constraint)
* **Issue:** The Rebalancing Agent is currently tasked with calculating the `regime_portfolio_alignment_score` directly via the LLM prompt. LLMs struggle with consistent mathematical constraints and weighted portfolio scoring.
* **Action Item:** Abstract the math. Pre-compute the alignment score deterministically in the pipeline before the LLM call. Pass this mathematical score *into* the Rebalancing Agent's prompt, constraining the LLM strictly to generating the qualitative rationale and resolving thesis conflicts.

### 2.2 Protect Against Prompt & Model Drift
* **Issue:** Foundational models (like `claude-3-5-sonnet`) update their underlying weights over time, which can silently change how they interpret the `regime_system.txt` prompt, even on identical macro data.
* **Action Item:** Implement a deterministic baseline test suite. Store 3–5 static `MacroFlatSnapshot` JSON fixtures representing distinct historical regimes (e.g., 2022 inflationary boom, 2008 deflationary crash). Integrate a CI/CD or scheduled script to run the prompt against these fixtures and assert the classification remains stable.

## 3. Developer Experience & Observability

### 3.1 Usability and Operational Timezones
* **Issue:** Cron jobs are hardcoded to `America/New_York` (e.g., EOD check at 16:15 ET), meaning end-of-day alerts trigger late at night local time (23:15 EEST). High-friction manual JSON configuration tasks immediately following a late-night Telegram ping lead to alert fatigue.
* **Action Item:** Adjust alert routing. Batch non-critical EOD alerts (like proximity warnings or missing configurations) into the morning digest (`dailyDigest.ts`) to align with working hours. Restrict immediate evening Telegram pings strictly to `CRITICAL` stop breaches or regime shifts.

### 3.2 Time-Travel Backtesting Harness
* **Issue:** The system relies on real-time cron triggers and single-file state (`regime_latest.json`), making it difficult to simulate historical point-in-time data to see how agents would have reacted.
* **Action Item:** Abstract the time context. Introduce a `virtual_date` parameter into the pipeline so a script can loop through historical periods without rewriting core business logic or relying on `new Date()`.

### 3.3 System Observability and Debugging Cognitive Load
* **Issue:** Auditing agent decisions currently requires manually cross-referencing `agent_runs.db`, `decision_log.db`, and raw JSON snapshots via SQL queries—a high cognitive load during rapid decision-making.
* **Action Item:** Build a specialized CLI command (e.g., `npx tsx src/cli.ts trace --symbol TLT`) or a localized, read-only HTML dashboard that stitches together and displays the exact chain of thought (raw FRED data → quadrant score → thesis conflict → final action) in a single human-readable view.
