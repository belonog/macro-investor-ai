# Macro Investor AI System — Project Specifications

> **Purpose:** AI-powered macro regime detection and portfolio rebalancing engine for a
> retail investor operating a growth/inflation framework.
> **Runtime:** Node.js 20+ / TypeScript 5.x — single service, single runtime
> **Primary AI:** Anthropic Claude API (`@anthropic-ai/sdk`)
> **Brokerage:** Interactive Brokers (Flex Reports — read-only, pure HTTPS, no gateway)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Directory Structure](#4-directory-structure)
5. [Environment & Configuration](#5-environment--configuration)
6. [Module Specifications](#6-module-specifications)
   - 6.1 [Types & Schemas](#61-types--schemas)
   - 6.2 [Data Fetchers](#62-data-fetchers)
   - 6.3 [Agent: Regime Detection ★](#63-agent-regime-detection-)
   - 6.4 [Agent: Portfolio Rebalancing ★](#64-agent-portfolio-rebalancing-)
   - 6.5 [Agent: Thesis Coherence](#65-agent-thesis-coherence)
   - 6.6 [Agent: Primary Data Interpreter](#66-agent-primary-data-interpreter)
   - 6.7 [EOD Position Monitor](#67-eod-position-monitor)
   - 6.8 [Base Agent & Database](#68-base-agent--database)
   - 6.9 [Alert Delivery](#69-alert-delivery)
   - 6.10 [Scheduler](#610-scheduler)
7. [Scheduled Flows](#7-scheduled-flows)
8. [Data Schemas](#8-data-schemas)
9. [Implementation Priorities](#9-implementation-priorities)
10. [Testing & Reliability Requirements](#10-testing--reliability-requirements)

---

## 1. Project Overview

### Core Value Proposition

The primary value of this system is **regime-aware intelligence**: continuously scoring the
macroeconomic environment against a growth/inflation framework, detecting regime transitions
before they fully price in, and translating that analysis into concrete portfolio rebalancing
recommendations anchored to the investor's current positions and theses.

Portfolio monitoring is secondary and scoped to position time horizon. Long-duration macro
positions are reviewed on a regime-event cadence. Speculative positions receive EOD proximity
checks. Real-time intraday monitoring is intentionally excluded — it introduces noise into a
framework designed to operate on a 3–12 month horizon.

### Value Hierarchy

```
PRIMARY
  1. Regime Detection Engine     — score current quadrant, detect transitions
  2. Portfolio Rebalancing Agent — translate regime signal into position actions

SECONDARY
  3. EOD Position Monitor        — stop proximity + thesis-invalidation thresholds
  4. Event-Driven Alerts         — earnings pre-briefs, yield threshold breaches
  5. Thesis Coherence Check      — pre-entry conflict analysis (CLI, on-demand)
  6. Primary Data Interpreter    — raw release interpretation through framework lens
```

### Design Principles

1. **Regime is the signal; price is the confirmation** — rebalancing decisions are regime-gated, not price-reactive
2. **Primary sources only** — no news APIs, no financial blogs as data inputs
3. **Thesis invalidation is mandatory** — every agent output must include the fastest path to being wrong
4. **Position time horizon determines monitoring frequency** — macro core positions reviewed weekly; speculative positions checked daily at EOD
5. **AI augments judgment, never replaces it** — all rebalancing suggestions require human confirmation
6. **Reproducible state** — every agent run logged with inputs, outputs, and timestamps

### Position Type Classification

```typescript
type PositionType = 'macro_core' | 'macro_hedge' | 'speculative' | 'equity_single';
```

| Type | Examples | Monitoring Cadence |
|---|---|---|
| `macro_core` | TLT, VGLT, SCHP, BRK-B | Regime-event-driven; weekly review |
| `macro_hedge` | ILF, SGOV | Weekly review; EOD if near stop |
| `speculative` | DUST, BTU, SM Energy | Daily EOD; hard deadline tracking |
| `equity_single` | ADBE, IBKR | EOD; earnings-event-driven |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│                                                                  │
│  FRED REST API │ BLS API │ EIA API │ Polygon.io │ IBKR Flex      │
│         (axios — all fetchers are plain HTTPS REST)              │
└────────────────────────────┬─────────────────────────────────────┘
                             │ structured JSON
                             │ cached to src/data/cache/
                ┌────────────▼─────────────────────┐
                │      REGIME ENGINE               │  ★ PRIMARY
                │  regimeAgent.ts                  │
                │  macro data → quadrant score +   │
                │  confidence + transition signals  │
                └────────────┬─────────────────────┘
                             │ RegimeAssessment
                ┌────────────▼─────────────────────┐
                │    REBALANCING AGENT             │  ★ PRIMARY
                │  rebalancingAgent.ts             │
                │  regime + portfolio →            │
                │  alignment score + action list   │
                └──────┬──────────────────────────┘
                       │
       ┌───────────────┼─────────────────────┐
       │               │                     │
┌──────▼──────┐ ┌──────▼────────┐ ┌──────────▼──────┐
│ Thesis      │ │ Data          │ │ EOD Monitor     │
│ Coherence   │ │ Interpreter   │ │ eodMonitor.ts   │
│ (CLI)       │ │ (on-demand)   │ │ (daily 4:15 ET) │
└──────┬──────┘ └──────┬────────┘ └──────────┬──────┘
       └───────────────┴──────────────────────┘
                             │
              ┌──────────────▼────────────────────┐
              │           OUTPUT LAYER            │
              │  Telegram │ SQLite │ JSON cache   │
              └───────────────────────────────────┘
```

---

## 3. Tech Stack

| Component | Tool | Notes |
|---|---|---|
| **Language** | TypeScript 5.x | Strict mode enabled |
| **Runtime** | Node.js 20+ | Native `fetch` available; use `axios` for consistency |
| **AI SDK** | `@anthropic-ai/sdk` | First-class TS support; streaming optional |
| **HTTP** | `axios` | All REST calls: FRED, BLS, EIA, Polygon, Telegram, IBKR Flex |
| **XML parsing** | `fast-xml-parser` | IBKR Flex Report XML → JSON |
| **Validation** | `zod` | All inter-module schemas; replaces pydantic |
| **Scheduling** | `node-cron` | All scheduled flows in one place |
| **Database** | `better-sqlite3` | Synchronous SQLite; agent logs, regime history |
| **Config** | `dotenv` | `.env` loading |
| **CLI** | `commander` | On-demand agent invocation (coherence, interpreter) |
| **Testing** | `vitest` | Unit + integration; fast, TS-native |
| **Linting** | `eslint` + `@typescript-eslint` | |
| **Build** | `tsx` (dev) / `tsc` (prod) | `tsx` for fast iteration; compile for production |

---

## 4. Directory Structure

```
macro-investor-ai/
│
├── .env                              # Secrets (never commit)
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
│
├── config/
│   ├── positions.json                # Portfolio state + types (manually maintained)
│   └── regime_weights.json           # Indicator weights for regime scoring
│
├── src/
│   ├── types/
│   │   └── index.ts                  # All Zod schemas + inferred types (single source of truth)
│   │
│   ├── data/
│   │   ├── fetchers/
│   │   │   ├── fredFetcher.ts        # FRED REST API wrapper
│   │   │   ├── blsFetcher.ts         # BLS Public API v2
│   │   │   ├── eiaFetcher.ts         # EIA API v2
│   │   │   ├── polygonFetcher.ts     # EOD prices + earnings calendar
│   │   │   └── flexReportFetcher.ts  # IBKR Flex Web Service
│   │   └── cache/                    # JSON cache files (gitignored)
│   │       ├── macro_snapshot.json
│   │       ├── positions_snapshot.json
│   │       └── regime_latest.json
│   │
│   ├── agents/
│   │   ├── baseAgent.ts              # Claude API wrapper + run logger
│   │   ├── regimeAgent.ts            # ★ Agent 1: Regime Detection
│   │   ├── rebalancingAgent.ts       # ★ Agent 2: Portfolio Rebalancing
│   │   ├── coherenceAgent.ts         # Agent 3: Thesis Coherence
│   │   └── interpreterAgent.ts       # Agent 4: Primary Data Interpreter
│   │
│   ├── monitor/
│   │   └── eodMonitor.ts             # EOD stop proximity + threshold checks
│   │
│   ├── utils/
│   │   ├── portfolioContext.ts       # buildPortfolioContext() — dynamic prompt injection
│   │   ├── positionsSync.ts          # syncPositions() — Flex → positions.json auto-update
│   │   └── manualIndicators.ts       # load/save manual indicators (ISM Services, FAO food)
│   │
│   ├── prompts/
│   │   ├── regime_system.txt
│   │   ├── rebalancing_system.txt
│   │   ├── coherence_system.txt
│   │   └── interpreter_system.txt
│   │
│   ├── flows/
│   │   ├── regimeCycle.ts            # ★ Flow 1: Regime update + rebalancing
│   │   ├── dailyDigest.ts            # Flow 2: Morning digest
│   │   ├── eodCheck.ts               # Flow 3: EOD snapshot + monitor
│   │   └── eventPrebrief.ts          # Flow 4: Pre-earnings/data brief
│   │
│   ├── alerts/
│   │   └── telegramBot.ts            # Telegraf bot + inline keyboard
│   │
│   ├── db/
│   │   └── database.ts               # SQLite setup + typed query helpers
│   │
│   ├── scheduler.ts                  # node-cron entry point (all jobs)
│   └── cli.ts                        # commander CLI for on-demand agents
│
├── tests/
│   ├── fetchers.test.ts
│   ├── agents.test.ts
│   └── flows.test.ts
│
└── logs/                             # SQLite databases (gitignored)
    ├── agent_runs.db
    ├── regime_history.db
    ├── alerts_sent.db
    └── decision_log.db
```

---

## 5. Environment & Configuration

### `.env.example`

```dotenv
# Anthropic
ANTHROPIC_API_KEY=your_key_here

# FRED REST API (free — fred.stlouisfed.org/docs/api)
FRED_API_KEY=your_key_here

# BLS Public API v2 (free — registrationKey optional but raises rate limit)
BLS_API_KEY=your_key_here

# EIA API v2 (free — eia.gov/opendata)
EIA_API_KEY=your_key_here

# Polygon.io (EOD prices + earnings calendar)
POLYGON_API_KEY=your_key_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# IBKR Flex Web Service (read-only, no local process required)
# Setup: Account Management → Reports → Flex Queries → Create Query + Token
IBKR_FLEX_TOKEN=your_flex_token
IBKR_FLEX_REPORT_ID=your_report_id
```

### `config/regime_weights.json`

```json
{
  "inflation_indicators": {
    "cpi_yoy":                    0.18,
    "pce_yoy":                    0.15,
    "breakeven_5y5y":             0.15,
    "ppi_yoy":                    0.10,
    "eci_wages":                  0.12,
    "tips_real_yield":            0.10,
    "oil_price_3m_change":        0.10,
    "fao_food_price_index":       0.05,
    "fertilizer_index_3m_change": 0.05
  },
  "growth_indicators": {
    "ism_manufacturing":  0.18,
    "ism_services":       0.18,
    "real_gdp_qoq":       0.18,
    "nfp_3m_avg":         0.12,
    "credit_spread_hy":   0.12,
    "consumer_sentiment": 0.08,
    "industrial_prod":    0.08,
    "savings_rate":       0.06
  },
  "regime_thresholds": {
    "inflation_high": 0.60,
    "inflation_low":  0.40,
    "growth_high":    0.55,
    "growth_low":     0.45
  },
  "transition_sensitivity": 0.10,
  "notes": {
    "credit_spread_hy": "Inverted for growth scoring — wider spreads = lower growth score",
    "savings_rate": "Inverted for growth scoring — rising savings = lower growth score",
    "tips_real_yield": "Higher real yield signals tighter financial conditions; inflationary if negative",
    "ism_services": "Manual monthly input until API source confirmed",
    "fao_food_price_index": "Manual monthly input from FAO website"
  }
}
```

---

## 6. Module Specifications

---

### 6.1 Types & Schemas

**File:** `src/types/index.ts`
**Role:** Single source of truth for all data shapes. All modules import from here.

```typescript
import { z } from 'zod';

// ── Position config (from positions.json) ────────────────────────────────────

export const PositionTypeSchema = z.enum([
  'macro_core', 'macro_hedge', 'speculative', 'equity_single'
]);

export const ThresholdMonitorSchema = z.object({
  indicator:    z.string(),
  warn_at:      z.number(),
  hard_exit_at: z.number(),
});

export const PositionConfigSchema = z.object({
  shares:               z.number(),
  avg_cost:             z.number(),
  position_type:        PositionTypeSchema,
  thesis:               z.string(),
  regime_match:         z.array(z.string()),
  stop:                 z.number(),
  hard_stop:            z.number().optional(),
  targets:              z.array(z.number()),
  thesis_invalidation:  z.string(),
  threshold_monitor:    ThresholdMonitorSchema.optional(),
  deadline:             z.string().optional(),   // ISO date string
  notes:                z.string().optional(),
});

export const PositionsConfigSchema = z.record(z.string(), PositionConfigSchema);

// ── IBKR Flex snapshot ────────────────────────────────────────────────────────

export const PositionSnapshotSchema = z.object({
  symbol:           z.string(),
  quantity:         z.number(),
  avgCost:          z.number(),
  marketPrice:      z.number(),   // prior close from Flex Report
  marketValue:      z.number(),
  unrealizedPnl:    z.number(),
  unrealizedPnlPct: z.number(),
  fetchedAt:        z.string(),   // ISO datetime string
});

export const PortfolioSnapshotSchema = z.object({
  positions:  z.array(PositionSnapshotSchema),
  fetchedAt:  z.string(),
});

// ── Regime assessment ─────────────────────────────────────────────────────────

export const RegimeQuadrantSchema = z.enum([
  'Goldilocks',
  'Inflationary Boom',
  'Stagflation',
  'Deflationary Recession',
]);

export const RegimeDriftSchema = z.enum([
  'Stable', 'Weakening', 'Transitioning', 'Shifted'
]);

export const RegimeAssessmentSchema = z.object({
  regime_quadrant:             RegimeQuadrantSchema,
  confidence:                  z.number().min(0).max(1),
  inflation_score:             z.number(),
  growth_score:                z.number(),
  regime_drift_vs_prior:       RegimeDriftSchema,
  transition_risk:             z.string(),
  confirming_indicators:       z.array(z.string()),
  contradicting_indicators:    z.array(z.string()),
  central_thesis_conflict:     z.string(),
  fastest_path_to_being_wrong: z.string(),
  watch_next:                  z.array(z.string()),
  assessed_at:                 z.string(),
});

// ── Rebalancing output ────────────────────────────────────────────────────────

export const RegimeFitSchema = z.enum(['Strong', 'Moderate', 'Weak', 'Misaligned']);
export const SuggestedActionSchema = z.enum(['Hold', 'Add', 'Trim', 'Exit', 'Watch']);
export const UrgencySchema = z.enum(['None', 'This Week', 'Immediate']);

export const PositionAssessmentSchema = z.object({
  symbol:           z.string(),
  position_type:    PositionTypeSchema,
  regime_fit:       RegimeFitSchema,
  thesis_intact:    z.boolean(),
  suggested_action: SuggestedActionSchema,
  action_rationale: z.string(),
  urgency:          UrgencySchema,
  conflict_flag:    z.string().nullable(),
});

export const RebalancingOutputSchema = z.object({
  regime_portfolio_alignment_score: z.number().min(0).max(1),
  alignment_grade:                  z.enum(['A', 'B', 'C', 'D']),
  position_assessments:             z.array(PositionAssessmentSchema),
  priority_actions:                 z.array(z.string()),
  regime_transition_implication:    z.string(),
  thesis_conflict_resolution:       z.string(),
  rebalancing_rationale:            z.string(),
  fastest_path_to_being_wrong:      z.string(),
});

// ── Alerts ────────────────────────────────────────────────────────────────────

export const AlertLevelSchema = z.enum(['INFO', 'WARNING', 'CRITICAL']);

export const AlertSchema = z.object({
  level:     AlertLevelSchema,
  symbol:    z.string().nullable(),
  message:   z.string(),
  action:    z.string().nullable(),
  createdAt: z.string(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type PositionConfig      = z.infer<typeof PositionConfigSchema>;
export type PositionsConfig     = z.infer<typeof PositionsConfigSchema>;
export type PositionSnapshot    = z.infer<typeof PositionSnapshotSchema>;
export type PortfolioSnapshot   = z.infer<typeof PortfolioSnapshotSchema>;
export type RegimeAssessment    = z.infer<typeof RegimeAssessmentSchema>;
export type RebalancingOutput   = z.infer<typeof RebalancingOutputSchema>;
export type PositionAssessment  = z.infer<typeof PositionAssessmentSchema>;
export type Alert               = z.infer<typeof AlertSchema>;
export type AlertLevel          = z.infer<typeof AlertLevelSchema>;
export type RegimeQuadrant      = z.infer<typeof RegimeQuadrantSchema>;
export type RegimeDrift         = z.infer<typeof RegimeDriftSchema>;
```

---

### 6.2 Data Fetchers

#### `src/data/fetchers/fredFetcher.ts`

**Responsibility:** Fetch macro indicator series from FRED REST API.
No external library — direct HTTPS via `axios`.

```typescript
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export const FRED_SERIES: Record<string, string> = {
  // Inflation — core
  cpi_yoy:           'CPIAUCSL',
  pce_yoy:           'PCEPI',
  ppi_yoy:           'PPIACO',
  breakeven_5y:      'T5YIE',
  breakeven_5y5y:    'T5YIFR',
  // Inflation — precision
  eci_wages:         'ECIALLCIV',   // Employment Cost Index; separates wage vs. supply inflation
  tips_real_yield:   'DFII10',      // Real yield; separates rate from inflation expectation
  // Growth — activity
  real_gdp:          'GDPC1',
  retail_sales:      'RSAFS',
  retail_sales_ex:   'RSXFS',       // Ex-autos; less volatile signal
  nfp:               'PAYEMS',
  industrial_prod:   'INDPRO',
  capacity_util:     'TCU',         // Inflationary pressure from supply constraints
  // Growth — stress / leading
  credit_spread_hy:  'BAMLH0A0HYM2', // HY OAS — key recession leading indicator
  credit_spread_ig:  'BAMLC0A0CM',   // IG OAS — pair with HY for spread context
  consumer_sentiment:'UMCSENT',      // UMich; demand destruction signal
  savings_rate:      'PSAVERT',      // Rising savings = demand compression incoming
  // Rates & Yield Curve
  fed_funds:         'FEDFUNDS',
  yield_2y:          'DGS2',
  yield_10y:         'DGS10',
  yield_30y:         'DGS30',
  curve_2s10:        'T10Y2Y',
  // Dollar, liquidity & debasement
  dxy_proxy:         'DTWEXBGS',
  m2:                'M2SL',
  gold_price:        'GOLDAMGBD228NLBM', // London gold fix; dollar confidence signal
};

// ── Supplemental indicators (non-FRED) ───────────────────────────────────────
//
// ISM Services (NMI): Not available on FRED. Source from ISM website directly
//   (ismworld.org) or a data vendor. Critical for separating services vs. goods
//   inflation and for assessing the services sector growth signal independently.
//   Fetch monthly; store in macro_snapshot.json under key "ism_services".
//
// Fertilizer index: No clean FRED series. Use FAO Food Price Index (monthly,
//   free at fao.org/worldfoodsituation) or World Bank Pink Sheet. Relevant as
//   a two-wave inflation transmission channel (energy → fertilizer → food CPI,
//   6–12 month lag). Fetch monthly; store under key "fao_food_price_index".
//   Consider as a manual monthly input until a clean API source is identified.
```

**Derived indicators** (computed in `getLatestValues()`, not fetched directly):
```typescript
// Compute and include in snapshot alongside raw series:
real_wages:       cpi_yoy - eci_wages   // Negative = stagflation signal
yield_curve_30_2: yield_30y - yield_2y  // Term premium; Treasury thesis context
```

**Caching:** Write to `src/data/cache/macro_snapshot.json` after each full fetch.
Include per-series `fetchedAt` timestamps. Stale threshold: 24h (daily series),
7 days (quarterly: GDP). Reject stale data before passing to agents.

---

#### `src/data/fetchers/blsFetcher.ts`

**Responsibility:** Fetch BLS series (NFP, CPI detail, PPI) via BLS Public API v2.

```typescript
const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

// Key series IDs
const BLS_SERIES = {
  nfp_total:       'CES0000000001',
  cpi_all_urban:   'CUUR0000SA0',
  ppi_final_demand: 'WPSFD4',
};

async function fetchSeries(seriesIds: string[], startYear: string, endYear: string): Promise<BLSResult[]>
async function getLatestReleases(): Promise<BLSRelease[]>
```

---

#### `src/data/fetchers/eiaFetcher.ts`

**Responsibility:** Fetch energy data via EIA API v2.

```typescript
const EIA_BASE = 'https://api.eia.gov/v2';

async function getCrudeOilPrice(): Promise<number>         // WTI spot
async function getNatGasPrice(): Promise<number>
async function getCrudeInventoryChange(): Promise<number>  // weekly EIA report
```

---

#### `src/data/fetchers/polygonFetcher.ts`

**Responsibility:** EOD prices for held symbols + earnings calendar.

```typescript
async function getEodPrices(symbols: string[]): Promise<Record<string, number>>
async function getEarningsCalendar(symbols: string[], daysAhead: number): Promise<EarningsEvent[]>

interface EarningsEvent {
  symbol:       string;
  reportDate:   string;
  epsEstimate:  number | null;
  timeOfDay:    'pre' | 'post' | 'unknown';
}
```

---

#### `src/data/fetchers/flexReportFetcher.ts`

**Responsibility:** Fetch EOD portfolio snapshot from IBKR Flex Web Service.
Pure HTTPS — no gateway, no session, no re-authentication.

**One-time setup:** Account Management → Reports → Flex Queries →
Create query (sections: `OpenPositions`, `UnrealizedPnL`, format: XML) → note Report ID.
Settings → Flex Web Service → Create Token.

```typescript
const FLEX_BASE =
  'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService';

async function requestReport(token: string, reportId: string): Promise<string>
// Step 1: Sends request, returns reference code from XML status response

async function downloadReport(token: string, refCode: string): Promise<string>
// Step 2: Polls until XML ready (max 10 attempts × 3s = 30s timeout)

export async function fetchPortfolioSnapshot(): Promise<PortfolioSnapshot>
// Full chain: requestReport → downloadReport → parseXml (fast-xml-parser)
//             → validate with PortfolioSnapshotSchema (zod)
//             → write to src/data/cache/positions_snapshot.json
//             → return typed PortfolioSnapshot
```

**Error handling:** On Zod validation failure → throw typed error with raw XML
attached for debugging. Never return partial/unvalidated data downstream.

---

### 6.3 Agent: Regime Detection ★

**File:** `src/agents/regimeAgent.ts`
**Trigger:** Weekly Sunday 9 AM ET + after any major macro release (CPI, NFP, GDP, PCE)
**Output cached to:** `src/data/cache/regime_latest.json` + inserted into `regime_history.db`

```typescript
interface RegimeAgentInput {
  macroSnapshot:   Record<string, number>;  // getLatestValues()
  regimeWeights:   RegimeWeights;           // config/regime_weights.json
  priorAssessment: RegimeAssessment | null; // null on first run
  recentReleases:  string[];               // brief descriptions of recent BLS/EIA releases
}

export async function runRegimeAgent(input: RegimeAgentInput): Promise<RegimeAssessment>
```

**Flow:**
1. Load system prompt template from `src/prompts/regime_system.txt`
2. Call `buildPortfolioContext(positionsConfig)` → structured portfolio summary string
3. Inject into template: `systemPrompt.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext)`
4. Build structured user message from `input` macro data
5. Call Claude API via `baseAgent.callClaude()`
6. Parse JSON response → validate with `RegimeAssessmentSchema`
7. Write to `src/data/cache/regime_latest.json`
8. Insert row into `regime_history.db`
9. Log full run to `agent_runs.db`
10. Return `RegimeAssessment`

**System prompt template** (`src/prompts/regime_system.txt`):

```
You are a macro regime analyst. Classify the current macroeconomic environment
using a four-quadrant growth/inflation framework.

QUADRANT DEFINITIONS:
- Goldilocks:             growth above trend, inflation below target
- Inflationary Boom:      growth above trend, inflation above target
- Stagflation:            growth below trend, inflation above target
- Deflationary Recession: growth below trend, inflation below target

CRITICAL — CONTRADICTING INDICATORS:
You must be equally rigorous identifying what CONTRADICTS the dominant regime
reading as what confirms it. The "fastest_path_to_being_wrong" field is
mandatory and must name the single most plausible scenario invalidating the
current classification within 60 days.

{{PORTFOLIO_CONTEXT}}

Respond ONLY in the specified JSON format. No preamble or text outside JSON.
```

**`{{PORTFOLIO_CONTEXT}}` is injected at runtime** from `buildPortfolioContext()`.
See Section 6.8 for implementation. Example rendered output:

```
CURRENT PORTFOLIO CONTEXT:
The investor holds the following positions (live from positions.json):

macro_core:    TLT (Deflationary Recession thesis — long-duration Treasuries)
               VGLT (Deflationary Recession thesis — long-duration Treasuries)
               SCHP (Stagflation thesis — TIPS inflation hedge)
               BRK-B (Deflationary Recession thesis — quality/value defensive)

macro_hedge:   ILF (Stagflation thesis — LatAm commodity/financial exposure)
               SGOV (Cash buffer, ~5% yield)

speculative:   DUST (Stagflation thesis — inverse gold miners; deadline 2026-05-31)
               BTU (Stagflation thesis — coal/energy; deadline none)
               SM Energy (Inflationary Boom thesis — oil E&P)

equity_single: ADBE (Earnings-driven; macro headwind in recession scenario)
               IBKR (Quality financial; partially grant-restricted)

DETECTED THESIS CONFLICTS:
- SM Energy (regime_match: Inflationary Boom) conflicts with TLT/VGLT
  (regime_match: Deflationary Recession). Oil bull vs. Treasury bull tension.

STRUCTURAL RISK FLAG (from prior assessment):
Petrodollar erosion / dollar debasement may invalidate nominal Treasury longs
independently of the growth/inflation quadrant.

The "central_thesis_conflict" field must directly address which narrative the
current data favors — stagflation (bearish nominal Treasuries) vs. deflationary
recession (bullish nominal Treasuries) — and with what confidence.
```

---

### 6.4 Agent: Portfolio Rebalancing ★

**File:** `src/agents/rebalancingAgent.ts`
**Trigger:** Automatically when `regime_drift_vs_prior` is `"Transitioning"` or
`"Shifted"`; also on-demand via CLI

```typescript
interface RebalancingAgentInput {
  regimeAssessment:  RegimeAssessment;
  portfolioSnapshot: PortfolioSnapshot;
  positionsConfig:   PositionsConfig;
  macroSnapshot:     Record<string, number>;
}

export async function runRebalancingAgent(
  input: RebalancingAgentInput
): Promise<RebalancingOutput>
```

**Validation:** Reject input if `regimeAssessment.assessed_at` is older than 7 days.
Throw `StaleRegimeError` with message indicating re-run of regime agent is required.

**System prompt** (`src/prompts/rebalancing_system.txt`):

```
You are a portfolio construction analyst for a macro regime investor.
Translate a regime assessment into concrete, prioritized portfolio actions
grounded in the investor's existing positions and stated theses.

CRITICAL CONSTRAINTS:
1. You suggest actions; the investor executes. Never imply automation.
2. Every "Exit" or "Trim" must reference the original thesis_invalidation
   condition from the position config, not just a price level.
3. Thesis conflicts between positions must be surfaced explicitly in
   "thesis_conflict_resolution".
4. "fastest_path_to_being_wrong" on the rebalancing itself is mandatory.

STANDARDS BY POSITION TYPE:
- macro_core:    Only suggest action if regime has shifted quadrant OR
                 thesis-invalidation threshold is approaching.
- macro_hedge:   Assess relative to regime; hold unless regime contradicts.
- speculative:   Assess against hard deadline and current thesis validity;
                 time decay of thesis is a valid exit reason.
- equity_single: Flag earnings risk; assess macro tailwind vs. headwind.

Respond ONLY in the specified JSON format. No preamble.
```

---

### 6.5 Agent: Thesis Coherence

**File:** `src/agents/coherenceAgent.ts`
**Trigger:** On-demand CLI only

```bash
npx tsx src/cli.ts coherence \
  --symbol GLD \
  --thesis "Adding gold as stagflation hedge; paper commodity exposure" \
  --size 500
```

```typescript
interface CoherenceInput {
  symbol:          string;
  thesis:          string;
  proposedSizeUsd: number;
  currentBook:     PositionsConfig;
  currentRegime:   RegimeAssessment;
}

interface CoherenceOutput {
  regimeMatch:         'Strong' | 'Moderate' | 'Weak' | 'Conflicting';
  correlationRisk:     string;
  thesisConflicts:     string[];
  sizingNote:          string;
  verdict:             'Proceed' | 'Reduce Size' | 'Reconsider' | 'Conflicts';
  questionsBeforeEntry: string[];   // 3 questions to answer before executing
}

export async function runCoherenceAgent(input: CoherenceInput): Promise<CoherenceOutput>
```

---

### 6.6 Agent: Primary Data Interpreter

**File:** `src/agents/interpreterAgent.ts`
**Trigger:** On-demand CLI + auto-triggered after major BLS/EIA releases

```bash
# Interactive paste mode
npx tsx src/cli.ts interpret --release CPI

# File input
npx tsx src/cli.ts interpret --release NFP --file ./data/releases/nfp_2026_05.txt
```

**Output structure — three mandatory sections:**
1. What this data **confirms** about the current regime reading
2. What this data **contradicts** about the current regime reading
3. What remains **ambiguous** and which upcoming release would resolve it

**System prompt constraint:** Explicitly prohibits consensus framing
(`"markets expected X, actual was Y"`). Interpretation is through the investor's
thesis lens only, using primary data values.

Output is Markdown-formatted — sent to Telegram and logged locally.

---

### 6.7 EOD Position Monitor

**File:** `src/monitor/eodMonitor.ts`
**Trigger:** Called from `eodCheck.ts` flow at 4:15 PM ET — **no Claude API call**

```typescript
// 1. Stop proximity check (all position types)
export function checkStopProximity(
  eodPrices:       Record<string, number>,
  positionsConfig: PositionsConfig,
  warningPct:      number = 0.03          // warn within 3% of stop
): Alert[]

// 2. Thesis-invalidation threshold check (macro_core only)
// Monitors the underlying indicator, not the ETF price
export function checkThesisThresholds(
  currentIndicators: Record<string, number>,
  positionsConfig:   PositionsConfig
): Alert[]
// Example: TLT/VGLT alerting on yield_30y crossing 4.50 / 5.10
// not on TLT price — keeps monitoring regime-aligned

// 3. Speculative deadline check
export function checkDeadlines(
  positionsConfig: PositionsConfig,
  warnDaysAhead:   number = 5
): Alert[]
```

**Design rationale:** `macro_core` positions are monitored against their
`threshold_monitor.indicator` value (e.g. `yield_30y`), not the ETF price.
The alert fires when the thesis-driver approaches its invalidation level —
consistent with the regime framework rather than price-reactive.

---

### 6.8 Base Agent & Database

#### `src/agents/baseAgent.ts`

**Responsibility:** Shared Claude API call wrapper with retry logic and run logging.

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface AgentCallOptions {
  systemPrompt: string;
  userMessage:  string;
  agentName:    string;
  trigger:      'scheduled' | 'post_release' | 'manual';
}

export async function callClaude(options: AgentCallOptions): Promise<string>
// Wraps Anthropic messages.create()
// Retry 3× with exponential backoff on 5xx
// Logs input hash, output, token usage to agent_runs.db
// Throws typed AgentError on final failure
```

#### `src/db/database.ts`

**Responsibility:** SQLite setup and typed query helpers using `better-sqlite3`.

```typescript
import Database from 'better-sqlite3';

// Opens / initialises all four databases on first run
export function initDatabases(): void

// Typed insert helpers
export function insertAgentRun(run: AgentRun): void
export function insertRegimeHistory(assessment: RegimeAssessment): void
export function insertAlert(alert: Alert): void
export function insertDecision(decision: Decision): void

// Query helpers
export function getLatestRegime(): RegimeAssessment | null
export function getRegimeHistory(limit: number): RegimeAssessment[]
export function acknowledgeAlert(id: number): void
```

**Schema:**

```sql
-- agent_runs.db
CREATE TABLE IF NOT EXISTS agent_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agent       TEXT NOT NULL,
  trigger     TEXT,
  input_hash  TEXT,
  input_json  TEXT,
  output_json TEXT,
  model       TEXT,
  tokens_used INTEGER
);

-- regime_history.db
CREATE TABLE IF NOT EXISTS regime_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  assessed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quadrant        TEXT,
  confidence      REAL,
  inflation_score REAL,
  growth_score    REAL,
  drift           TEXT,
  full_output     TEXT
);

-- alerts_sent.db
CREATE TABLE IF NOT EXISTS alerts_sent (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  level        TEXT,
  symbol       TEXT,
  message      TEXT,
  acknowledged INTEGER DEFAULT 0,
  ack_at       TIMESTAMP
);

-- decision_log.db
CREATE TABLE IF NOT EXISTS decision_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  symbol         TEXT,
  action         TEXT,
  rationale      TEXT,
  regime_at_time TEXT,
  price          REAL,
  notes          TEXT
);
```

---

### 6.8.1 Utility: `buildPortfolioContext`

**File:** `src/utils/portfolioContext.ts`
**Called by:** All agents before constructing their system prompt.
Replaces hardcoded portfolio references with live data from `positions.json`.

```typescript
export function buildPortfolioContext(positionsConfig: PositionsConfig): string
```

**Logic:**
1. Group positions by `position_type`
2. For each position, format: `symbol (regime_match — thesis summary)`
3. Detect thesis conflicts: find pairs where `regime_match` arrays are mutually contradictory
   (e.g. `["Deflationary Recession"]` vs `["Inflationary Boom"]`)
4. Flag any `speculative` positions with `deadline` within 30 days
5. Return structured plain-text block for prompt injection

**Example output:**
```
CURRENT PORTFOLIO CONTEXT (live from positions.json):

macro_core:    TLT   — Deflationary Recession — long-duration Treasuries
               VGLT  — Deflationary Recession — long-duration Treasuries
               SCHP  — Stagflation            — TIPS inflation hedge
               BRK-B — Deflationary Recession — quality/value defensive

macro_hedge:   ILF   — Stagflation            — LatAm commodity/financial exposure
               SGOV  — (cash buffer, yield)

speculative:   DUST  — Stagflation            — inverse gold miners [DEADLINE: 2026-05-31]
               BTU   — Stagflation            — coal/energy
               SM    — Inflationary Boom      — oil E&P

equity_single: ADBE  — (earnings-driven; macro headwind in recession)
               IBKR  — (quality financial; partially grant-restricted)

DETECTED THESIS CONFLICTS:
- SM Energy (Inflationary Boom) conflicts with TLT/VGLT (Deflationary Recession)
  → Oil bull thesis directly contradicts Treasury bull thesis
```

**Usage pattern** (same across all agents):
```typescript
const template = fs.readFileSync('src/prompts/regime_system.txt', 'utf-8');
const portfolioContext = buildPortfolioContext(positionsConfig);
const systemPrompt = template.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);
```

---

### 6.8.2 Utility: `syncPositions`

**File:** `src/utils/positionsSync.ts`
**Called by:** `eodCheck.ts` flow, after Flex snapshot is fetched.
**Purpose:** Auto-update quantitative fields in `positions.json` from live Flex data.
Semantic fields (thesis, stop, position_type, etc.) are never touched.

```typescript
interface SyncResult {
  updated:    string[];   // symbols with changed quantitative fields
  newSymbols: string[];   // symbols in Flex but missing from positions.json
  removed:    string[];   // symbols in positions.json but absent from Flex (closed positions)
}

export function syncPositions(
  snapshot:        PortfolioSnapshot,
  positionsConfig: PositionsConfig,
  configPath:      string            // path to positions.json for writing
): SyncResult
```

**Auto-updated fields** (safe — sourced directly from Flex Report):
```typescript
shares    ← snapshot.quantity
avg_cost  ← snapshot.avgCost       // only if differs by > 0.5% (new fill detected)
```

**Never auto-updated** (require human judgment):
```typescript
thesis, thesis_invalidation, position_type,
regime_match, stop, hard_stop, targets,
threshold_monitor, deadline, notes
```

**Alerts generated by sync:**

```
🟡 WARNING — New position detected: ADBE (10 shares, avg $275.40)
No thesis or config found in positions.json.
Run: npx tsx src/cli.ts add-position --symbol ADBE
Position excluded from regime analysis until configured.

🟡 WARNING — Position closed or fully exited: DUST
Still present in positions.json. Remove or archive manually.
```

---

### 6.8.3 Utility: `manualIndicators`

**File:** `src/utils/manualIndicators.ts`
**Purpose:** Handle indicators that have no clean REST API source.
Stored in `src/data/cache/manual_indicators.json`.

**Current manual indicators:**

| Indicator | Source | Frequency | Key |
|---|---|---|---|
| ISM Services (NMI) | ismworld.org | Monthly | `ism_services` |
| FAO Food Price Index | fao.org/worldfoodsituation | Monthly | `fao_food_price_index` |

```typescript
interface ManualIndicator {
  value:       number;
  period:      string;   // "2026-04" — YYYY-MM
  updatedAt:   string;   // ISO datetime; agent checks staleness
  source:      string;   // URL or description
}

export function getManualIndicators(): Record<string, ManualIndicator>
export function setManualIndicator(key: string, value: ManualIndicator): void
```

**CLI update command:**
```bash
# Update ISM Services after monthly release
npx tsx src/cli.ts set-indicator --key ism_services --value 51.6 --period 2026-05

# Update FAO food price index
npx tsx src/cli.ts set-indicator --key fao_food_price_index --value 128.3 --period 2026-04
```

`getLatestValues()` in `fredFetcher.ts` merges manual indicators into the macro
snapshot before returning, so agents receive a unified `Record<string, number>`
regardless of source.

---

### 6.9 Alert Delivery

**File:** `src/alerts/telegramBot.ts`
Single delivery channel. Uses `telegraf` for inline keyboard support.

**Alert levels:**
```
🟢 INFO     — regime update (stable), weekly digest, no action required
🟡 WARNING  — within 3% of stop, threshold within 25bp of warn level,
              binary event in 48h, speculative deadline in 5 days
🔴 CRITICAL — stop breach (EOD), thesis-invalidation threshold breached,
              regime has shifted quadrant
```

**Rebalancing report format** (primary weekly output):
```
🟢 REGIME REPORT — Sun May 18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Regime:     Stagflation → Drifting (71%)
Drift:      Weakening — Deflationary Recession signal building
Alignment:  B  (68% regime-aligned)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIORITY ACTIONS:
1. [TRIM — This Week]  SM Energy: resolve oil/Treasury conflict
2. [WATCH]             TLT: 30yr yield 4.73% — warn level 4.50% breached
3. [HOLD]              SCHP: strong stagflation alignment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fastest path to being wrong:
ISM Services re-accelerates above 55, removing recession signal.
[View Full Report]
```

**Inline keyboard on CRITICAL alerts:**
- `[Acknowledge]` — suppresses re-alert 60 min; writes `ack_at` to `alerts_sent.db`
- `[Run Rebalancing]` — triggers `runRebalancingAgent()` on-demand; sends output to Telegram

---

### 6.10 Scheduler

**File:** `src/scheduler.ts`

```typescript
import cron from 'node-cron';
import { runRegimeCycle }   from './flows/regimeCycle';
import { runDailyDigest }   from './flows/dailyDigest';
import { runEodCheck }      from './flows/eodCheck';
import { runEventPrebrief } from './flows/eventPrebrief';

// ★ Regime cycle — weekly + manually triggered post-release
cron.schedule('0 9 * * 0', runRegimeCycle, {
  timezone: 'America/New_York'
});

// Daily digest — weekday mornings (reads cache, no Claude call unless stale)
cron.schedule('0 7 * * 1-5', runDailyDigest, {
  timezone: 'America/New_York'
});

// EOD check — Flex snapshot + monitor, weekdays after close
cron.schedule('15 16 * * 1-5', runEodCheck, {
  timezone: 'America/New_York'
});

// Event pre-brief — check upcoming events each evening
cron.schedule('0 18 * * 0-4', runEventPrebrief, {
  timezone: 'America/New_York'
});
```

---

## 7. Scheduled Flows

### Flow 1: Regime Cycle (`src/flows/regimeCycle.ts`) ★ Primary
**Schedule:** Sunday 9:00 AM ET + on-demand post major macro release

```
1. fredFetcher.fetchAll()          → write macro_snapshot.json
2. blsFetcher.getLatestReleases()
3. eiaFetcher.getLatest()
4. Load prior assessment from regime_latest.json (null if first run)

5. regimeAgent.run({ macroSnapshot, regimeWeights, priorAssessment, recentReleases })
   → validate output with RegimeAssessmentSchema (zod)
   → write to src/data/cache/regime_latest.json
   → insert into regime_history.db

6. IF drift IN ['Transitioning', 'Shifted']:
     Load positions_snapshot.json (verify fetchedAt < 26h)
     Load config/positions.json
     rebalancingAgent.run({ regimeAssessment, portfolioSnapshot, positionsConfig })
     → Send full rebalancing report to Telegram
       (🔴 CRITICAL if 'Shifted'; 🟡 WARNING if 'Transitioning')
   ELSE:
     Send brief regime status update (🟢 INFO — stable, no action)

7. Log full run to agent_runs.db
```

---

### Flow 2: Daily Digest (`src/flows/dailyDigest.ts`)
**Schedule:** 7:00 AM ET, Mon–Fri

```
1. Read regime_latest.json — check assessed_at
   IF stale > 7 days: run regimeCycle.ts first
2. polygonFetcher.getEarningsCalendar(heldSymbols, daysAhead=1)
3. fredFetcher.getLatestValues() — freshness check on yield_30y, breakeven_5y5y
4. Format and send Telegram digest:
   - Current regime quadrant + confidence + assessed date
   - Indicators that moved > threshold since prior day
   - Today's earnings / economic events for held symbols
```

---

### Flow 3: EOD Check (`src/flows/eodCheck.ts`)
**Schedule:** 4:15 PM ET, Mon–Fri

```
1. flexReportFetcher.fetchPortfolioSnapshot()
   → validate with zod → write to positions_snapshot.json

2. syncPositions(snapshot, positionsConfig, 'config/positions.json')
   → auto-update shares / avg_cost from Flex data
   → alert on new unrecognized symbols (🟡 WARNING → add-position prompt)
   → alert on positions present in config but absent from Flex (closed position)

3. polygonFetcher.getEodPrices(heldSymbols)
4. fredFetcher.getLatestValues()   — for threshold monitor indicators (yield_30y, etc.)

5. eodMonitor.checkStopProximity(eodPrices, positionsConfig)
6. eodMonitor.checkThesisThresholds(currentIndicators, positionsConfig)
7. eodMonitor.checkDeadlines(positionsConfig)

8. For each alert: telegramBot.send(alert)
9. Log all alerts to alerts_sent.db
```

**Note:** Flex fetch, sync, and EOD monitor run sequentially in the same flow —
no cross-service handoff or timing dependency.

---

### Flow 4: Event Pre-Brief (`src/flows/eventPrebrief.ts`)
**Schedule:** 6:00 PM ET, Sun–Thu

```
1. polygonFetcher.getEarningsCalendar(heldSymbols, daysAhead=2)
2. For each event within 48h:
   interpreterAgent.generatePrebrief(symbol, thesis, eventDetails)
3. telegramBot.send(prebrief, level='WARNING')
```

---

### CLI: On-Demand Agents (`src/cli.ts`)

```bash
# Full rebalancing report
npx tsx src/cli.ts rebalance

# Thesis coherence check
npx tsx src/cli.ts coherence --symbol XLE --thesis "..." --size 1000

# Primary data interpreter
npx tsx src/cli.ts interpret --release CPI --paste-mode
npx tsx src/cli.ts interpret --release NFP --file ./data/releases/nfp_2026_05.txt

# Force regime cycle (e.g. after a major release)
npx tsx src/cli.ts regime --trigger post_release

# Scaffold a new position entry in positions.json
# Prompts interactively for: position_type, thesis, stop, targets, thesis_invalidation
# Writes a validated entry skeleton; human fills in regime_match and notes
npx tsx src/cli.ts add-position --symbol ADBE

# Update a manual indicator (ISM Services, FAO food price index)
npx tsx src/cli.ts set-indicator --key ism_services --value 51.6 --period 2026-05
npx tsx src/cli.ts set-indicator --key fao_food_price_index --value 128.3 --period 2026-04
```

**`add-position` interactive flow:**
```
$ npx tsx src/cli.ts add-position --symbol ADBE

Adding position: ADBE
Shares and avg_cost will be auto-populated from next Flex sync.

? Position type: (macro_core / macro_hedge / speculative / equity_single)
  > equity_single

? Thesis (why are you holding this?):
  > AI-driven growth; beneficiary of enterprise software spend recovery

? Stop price: 240

? Target price(s) (comma-separated): 300, 340

? Thesis invalidation condition:
  > AI adoption slows materially; Adobe fails to monetize Firefly at scale

✓ Entry written to config/positions.json
  Reminder: set regime_match and threshold_monitor manually if applicable.
```

---

## 8. Data Schemas

### 8.1 `config/positions.json`

```json
{
  "TLT": {
    "shares": 268,
    "avg_cost": 88.50,
    "position_type": "macro_core",
    "thesis": "Long-duration Treasury recession play. Fed forced to cut as growth collapses.",
    "regime_match": ["Deflationary Recession"],
    "stop": 89.50,
    "hard_stop": 87.00,
    "targets": [95.00, 100.00],
    "thesis_invalidation": "30-year yield breaks above 5.10% on sustained basis; stagflation regime confirmed with no recession signal",
    "threshold_monitor": {
      "indicator": "yield_30y",
      "warn_at": 4.50,
      "hard_exit_at": 5.10
    },
    "notes": "Trim trigger at 30yr yield ~4.50%. Hard exit ~5.10%."
  },
  "DUST": {
    "shares": 30,
    "avg_cost": 140.00,
    "position_type": "speculative",
    "thesis": "Inverse gold miners. Miners underperform physical gold in stagflation due to input cost compression.",
    "regime_match": ["Stagflation"],
    "stop": 58.00,
    "targets": [90.00],
    "deadline": "2026-05-31",
    "thesis_invalidation": "Gold miners outperform physical gold on sustained basis; operational costs decline materially",
    "notes": "Target revised to $90 (forward-looking). Sunk cost trap explicitly acknowledged."
  }
}
```

**Field maintenance reference:**

| Field | Maintained by | Notes |
|---|---|---|
| `shares` | **Auto** — `syncPositions` | Updated from Flex Report on every EOD run |
| `avg_cost` | **Auto** — `syncPositions` | Updated only if new fill detected (> 0.5% change) |
| `position_type` | **Manual** | Required; set via `add-position` CLI on entry |
| `thesis` | **Manual** | Set on entry; update if thesis evolves |
| `thesis_invalidation` | **Manual** | Set on entry; the key field for agent reasoning |
| `regime_match` | **Manual** | Set on entry; drives rebalancing alignment scoring |
| `stop` / `hard_stop` | **Manual** | Update after technical analysis; never auto-adjusted |
| `targets` | **Manual** | Update as thesis develops |
| `threshold_monitor` | **Manual** | `macro_core` only; set on entry |
| `deadline` | **Manual** | `speculative` only; critical for EOD deadline alerts |
| `notes` | **Manual** | Free text; any relevant context |

*`position_type` is required on all entries — used by the rebalancing agent and EOD monitor
to determine behavior and cadence. New positions detected in Flex but absent from
`positions.json` generate a `🟡 WARNING` alert and are excluded from agent analysis
until configured via `add-position`.*

---

## 9. Implementation Priorities

| Phase | Module(s) | Value Delivered |
|---|---|---|
| **1** | `fredFetcher.ts` + `regimeAgent.ts` + `regimeCycle.ts` | ★ Core engine live; weekly regime scoring operational |
| **2** | `rebalancingAgent.ts` | ★ Regime → actionable portfolio recommendations |
| **3** | `flexReportFetcher.ts` + `positionsSync.ts` + `eodCheck.ts` | Real portfolio state feeds agents; auto-sync keeps positions.json current |
| **4** | `eodMonitor.ts` + `eodCheck.ts` flow | EOD stop proximity + yield threshold alerts |
| **5** | `eventPrebrief.ts` + `interpreterAgent.ts` | Event pre-briefs; primary data interpretation |
| **6** | `coherenceAgent.ts` + `cli.ts` | Pre-entry thesis conflict check |

**Manual indicators note:** ISM Services and FAO Food Price Index have no clean REST API.
Update them monthly via `npx tsx src/cli.ts set-indicator` immediately after each release.
The regime engine will alert if a manual indicator is stale (> 35 days) before a regime cycle run.

**Phase 1 note:** Build and backtest the regime engine before connecting any live
portfolio data. Feed 12 months of historical FRED data sequentially through
`regimeAgent.ts` and verify quadrant classifications match your own prior
readings. Tune `regime_weights.json` until scoring aligns with your framework
on known historical regimes (e.g. 2022 stagflation, late 2023 soft-landing)
before connecting Flex Reports or running against live data.

---

## 10. Testing & Reliability Requirements

### Unit Tests (`tests/`)

- **`fetchers.test.ts`** — mock `axios` responses for FRED, Polygon, Flex; verify Zod schema compliance on valid input; verify typed errors on malformed input
- **`agents.test.ts`** — fixture inputs for regime and rebalancing agents; verify output schema; test regime scoring logic against known historical data; verify `StaleRegimeError` thrown on stale input to rebalancing agent
- **`flows.test.ts`** — integration tests with mocked fetchers and Telegram client; verify correct flow branching (e.g. rebalancing triggered only on drift `"Transitioning"` or `"Shifted"`)
- **`utils.test.ts`** — unit tests for `buildPortfolioContext`: verify conflict detection between opposing `regime_match` arrays; verify deadline flagging for speculative positions; verify prompt injection produces no hardcoded symbol names. Unit tests for `syncPositions`: verify quantitative fields updated; verify semantic fields untouched; verify correct alerts for new/missing symbols

### Reliability Standards

| Component | Requirement |
|---|---|
| Regime agent | Zod schema validation on output before caching; Telegram alert on run failure |
| Rebalancing agent | Rejects `RegimeAssessment` older than 7 days; throws `StaleRegimeError` |
| Flex snapshot | Stale threshold: 26h; EOD monitor skips and alerts if snapshot older than 30 min at run time |
| Claude API | Retry 3× exponential backoff on 5xx via `baseAgent.ts`; log all failures |
| FRED cache | Check `fetchedAt` before regime cycle; alert if fetch fails |
| Manual indicators | Stale threshold: 35 days; regime agent alerts if `ism_services` or `fao_food_price_index` overdue |
| `positions.json` sync | Warn if any symbol in Flex has no `positions.json` entry; excluded from analysis until configured |
| Telegram | Retry on failure; log locally after 3 failed delivery attempts |
| All Zod parse failures | Logged with raw input + thrown as typed errors; never silently swallowed |

### Backtesting the Regime Engine (Required Before Production)

Before using regime output to inform real portfolio decisions:
1. Feed 12 months of historical FRED data through `regimeAgent.ts` in sequence
2. Compare quadrant classifications against your own prior readings for the same periods
3. Verify `central_thesis_conflict` correctly identifies the stagflation vs. deflation tension across different data environments
4. Tune `regime_weights.json` until scoring matches your framework intuition on known historical regimes

---

*Generated for Claude Code implementation. All API credentials in `.env` — never hardcoded.*
