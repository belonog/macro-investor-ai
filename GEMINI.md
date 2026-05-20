# Macro Investor AI — Project Instructions

## Current Architecture (Spec v3)
The system has been fully migrated to **Spec v3**. All operations follow the "Regime-First" framework.

### Core Value Hierarchy
1. **Regime Detection**: Weekly assessment of growth/inflation quadrant.
2. **Rebalancing**: Translation of regime signal into portfolio action.
3. **EOD Monitoring**: Daily check of stops, thesis thresholds, and deadlines.
4. **Event Pre-Brief**: AI analysis of upcoming earnings events.

### CLI Usage
Use the unified CLI for all manual and on-demand operations:
- `npx tsx src/cli.ts regime`: Run full macro assessment and rebalancing check.
- `npx tsx src/cli.ts eod`: Sync positions from IBKR Flex and check risk thresholds.
- `npx tsx src/cli.ts prebrief`: Generate AI briefs for upcoming earnings events.
- `npx tsx src/cli.ts interpret <release> <data>`: Analyze raw data through the macro lens.
- `npx tsx src/cli.ts coherence <symbol> <thesis>`: Verify trade-thesis alignment before entry.

### Automation
- **Scheduler**: Managed by `src/scheduler.ts` using `node-cron`.
- **Database**: Runs and history are logged to SQLite databases in `logs/`.
- **Alerts**: Delivered via Telegram with inline keyboard support for acknowledgments.

### Verification Standards
- **Backtesting**: Use `examples/backtest_regime_engine.ts` to verify model accuracy against historical FRED data.
- **Tests**: Maintain 100% pass rate in `vitest` suite.
- **Linting**: Maintain 0 errors in ESLint suite via `pnpm run lint` after any code change.
- **Type Safety**: Maintain 0 errors in `tsc --noEmit`.
- **Zod**: Every data boundary (fetchers, agent outputs, config) must be validated via Zod.

## Definition of Done (DoD)
No task is considered complete until the following "Iron Law" of verification is met and evidenced:
1. **Linter Clean**: `pnpm run lint` passes with 0 errors.
2. **Type-Safe**: `tsc --noEmit` passes with 0 errors.
3. **Tests Passing**: `pnpm test` passes with 100% success rate.
4. **No Hacks**: No `@ts-ignore`, `any` casts, or suppressed linter warnings.
5. **Evidence Provided**: The CLI output of these commands must be shown in the final turn of the task.

## Project Configuration
- **Package Manager**: `pnpm` (managed via `packageManager` field in `package.json`).
- **Runtime**: Node.js (ESM).
- **Tooling**: `typescript` for type safety, `vitest` for testing, `tsx` for direct execution.

### Useful Commands
- `pnpm install`: Install project dependencies.
- `pnpm run build`: Type-check and build the project to `dist/`.
- `pnpm test`: Run all tests once.
- `pnpm test -- --watch`: Run tests in watch mode.
- `pnpm run dev`: Run the CLI directly from source.
- `pnpm run cli`: Run the CLI (alias for `src/cli.ts`).

## Development Workflows
- **Prompting**: All system prompts reside in `src/prompts/`. Never use consensus-based framing; prioritize "Thesis Invalidation" and the growth/inflation quadrant.
- **Data**: Primary data only (FRED, BLS, EIA, Polygon). No news or sentiment APIs.
- **Positions**: Managed via `config/positions.json`. Quantitative fields are auto-synced; semantic fields (thesis, regime_match) are manual.

## Key Architectural Decisions & Project Memory

### Macro Data Pipeline Decoupling (Spec v3 Refinement)
1. **Fetching Layer (`src/data/fetchers/`)**: Handles HTTP requests, cache synchronization, and Zod validation of raw data streams. Banned from doing indicator math, hardcoding metadata descriptions, or asserting semantic properties.
2. **Registry Layer (`src/data/indicators/registry.ts`)**: Single source of truth for indicator definitions, description texts, data sources, update frequencies, and mappings from raw FRED series/Polygon tickers to semantic keys.
3. **Derivation Layer (`src/data/indicators/derivation.ts`)**: Consumes `MacroSnapshot` data and performs all mathematical derivations (YoY %, rolling averages, yield curve spreads, real wages formulas, credit spread deltas), returning a typed semantic-keyed `MacroIndicators` record.

### Key Downstream Rules
- **Semantic Key Principle**: Downstream components (agents, alert pipelines, daily digest, and EOD warning checks) must query clean semantic keys (e.g. `cpi_yoy_pct`, `yield_30y_pct`) rather than raw FRED/Polygon ticker IDs.
- **Dynamic Configuration Lookups**: Determine update frequency and metadata from `INDICATORS` registry rather than hardcoding static maps in agents.

