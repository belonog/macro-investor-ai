# Macro Investor AI

An AI-powered macro regime detection and portfolio rebalancing engine for retail investors operating on a growth/inflation framework. 

Macro Investor AI continuously scores the macroeconomic environment, detects regime transitions before they fully price in, and translates that analysis into concrete portfolio rebalancing recommendations anchored to the investor's current positions and theses.

## Core Value Proposition

The system is designed around **regime-aware intelligence**:
- **Regime is the signal; price is the confirmation** — Rebalancing decisions are regime-gated, not price-reactive.
- **Primary sources only** — Driven by primary data (FRED, BLS, EIA) rather than news or sentiment APIs.
- **Position time horizon determines monitoring frequency** — Macro positions are reviewed weekly; speculative positions receive daily end-of-day (EOD) checks.
- **AI augments judgment, never replaces it** — Rebalancing suggestions require human confirmation.

## Architecture

The system is built on **Node.js (TypeScript)** and leverages the **Vercel AI SDK** to remain provider-agnostic (supporting Anthropic Claude, Google Gemini, etc.).

It utilizes a series of independent intelligent agents:
1. **Regime Detection Engine (`regimeAgent`)**: Evaluates macro data against a quadrant framework (Goldilocks, Inflationary Boom, Stagflation, Deflationary Recession).
2. **Portfolio Rebalancing Agent (`rebalancingAgent`)**: Translates the regime signal into portfolio actions based on current holdings.
3. **EOD Position Monitor (`eodMonitor`)**: Checks stop proximity and thesis-invalidation thresholds daily.
4. **Event-Driven Alerts (`eventPrebrief`)**: Analyzes upcoming earnings events or data releases.
5. **Thesis Coherence Check (`coherenceAgent`)**: Analyzes pre-entry conflicts on demand.
6. **Primary Data Interpreter (`interpreterAgent`)**: Interprets raw releases through the macro framework lens.

## Prerequisites

- **Node.js** 20+
- **pnpm** (Package Manager)
- API Keys for the following services:
  - AI Provider (e.g., Anthropic, Google Gemini)
  - FRED REST API
  - BLS Public API v2
  - EIA API v2
  - Polygon.io
  - Telegram Bot Token & Chat ID
  - Interactive Brokers (IBKR) Flex Web Service Token

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd macro-investor-ai
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure the environment:**
   Copy `.env.example` to `.env` and fill in your API keys and configuration parameters.
   ```bash
   cp .env.example .env
   ```

4. **Initialize configurations:**
   Ensure `config/positions.json`, `config/regime_pipeline.json`, and `config/regime_weights.json` are properly set up based on the provided examples.

## Usage

Macro Investor AI features a unified CLI for all manual and on-demand operations.

### Main CLI Commands

- **Run Regime Cycle (Post-Release/Weekly)**
  Executes the full macro assessment and checks for rebalancing needs.
  ```bash
  npx tsx src/cli.ts regime
  ```

- **Run EOD Check**
  Syncs positions from the IBKR Flex report and evaluates risk thresholds.
  ```bash
  npx tsx src/cli.ts eod
  ```

- **Generate Pre-Brief**
  Creates AI briefs for upcoming earnings events within 48 hours.
  ```bash
  npx tsx src/cli.ts prebrief
  ```

- **Interpret Raw Data**
  Analyzes raw macro data releases through the thesis lens.
  ```bash
  npx tsx src/cli.ts interpret <release> <data>
  ```

- **Check Thesis Coherence**
  Verifies trade-thesis alignment before position entry.
  ```bash
  npx tsx src/cli.ts coherence --symbol <SYMBOL> --thesis "<your_thesis>" --size <AMOUNT>
  ```

- **Add a Position**
  Scaffolds a new position entry interactively in `positions.json`.
  ```bash
  npx tsx src/cli.ts add-position --symbol <SYMBOL>
  ```

- **Update Manual Indicators**
  Updates indicators that lack a clean REST API (e.g., ISM Services, FAO Food Price Index).
  ```bash
  npx tsx src/cli.ts set-indicator --key ism_services --value 51.6 --period 2026-05
  ```

### Automated Scheduled Flows

The system relies on `node-cron` via `src/scheduler.ts` to automate recurring tasks:
- **Sunday 9:00 AM ET:** Weekly Regime Cycle
- **Monday–Friday 7:00 AM ET:** Morning Daily Digest
- **Monday–Friday 4:15 PM ET:** EOD Check & Flex Sync
- **Sunday–Thursday 6:00 PM ET:** Event Pre-Brief

Run the scheduler continuously in the background (e.g., using `pm2` or `systemd`):
```bash
pnpm start # Or run `npx tsx src/scheduler.ts`
```

## Data and State Management

- **Databases (`logs/`)**: Agent runs, regime history, decision logs, and sent alerts are persisted to synchronous SQLite databases via `better-sqlite3`.
- **Cache (`src/data/cache/`)**: Transient JSON states including the latest macro snapshot, regime assessment, and IBKR portfolio snapshot.
- **Portfolio Context (`config/positions.json`)**: Semantic fields (thesis, stop, position type) are maintained manually, while quantitative fields (shares, avg. cost) are auto-synced daily from IBKR Flex.

## Testing

Ensure the system correctly interprets logic without regressions using the `vitest` suite.

```bash
pnpm test
```

For historical backtesting and validation of the regime engine against your expected framework, use the backtest utility:
```bash
npx tsx examples/backtest_regime_engine.ts
```

## Disclaimer

**Not Financial Advice:** This software is for educational and research purposes only. It is a tool for structuring thought and organizing data according to a predefined macro framework. All outputs are AI-generated suggestions that require manual human review and validation before executing real financial trades. 
