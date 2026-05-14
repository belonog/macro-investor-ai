# Macro Investor AI System — Project Specifications

> **Purpose:** AI-powered macro regime detection and portfolio rebalancing engine for a
> retail investor operating a growth/inflation framework.
> **Target runtime:** Local machine + cloud APIs
> **Primary AI:** Gemini API (gemini-3-flash-preview)
> **Brokerage:** Interactive Brokers (Flex Reports — read-only, no TWS, no gateway)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Directory Structure](#4-directory-structure)
5. [Environment & Configuration](#5-environment--configuration)
6. [Module Specifications](#6-module-specifications)
   - 6.1 [Data Layer — REST APIs (TypeScript)](#61-data-layer--rest-apis-typescript)
   - 6.2 [Data Layer — IBKR Flex Reports (TypeScript)](#62-data-layer--ibkr-flex-reports-typescript)
   - 6.3 [Agent: Regime Detection ★](#63-agent-regime-detection-)
   - 6.4 [Agent: Portfolio Rebalancing ★](#64-agent-portfolio-rebalancing-)
   - 6.5 [Agent: Thesis Coherence](#65-agent-thesis-coherence)
   - 6.6 [Agent: Primary Data Interpreter](#66-agent-primary-data-interpreter)
   - 6.7 [EOD Position Monitor](#67-eod-position-monitor)
   - 6.8 [Orchestrators](#68-orchestrators)
   - 6.9 [Alert Delivery](#69-alert-delivery)
   - 6.10 [Decision Log](#610-decision-log)
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
positions are reviewed on a regime-event cadence. Shorter-duration speculative positions
receive EOD proximity checks. Real-time intraday monitoring is intentionally excluded —
it introduces noise into a framework designed to operate on a 3–12 month horizon.

### Value Hierarchy

```
PRIMARY
  1. Regime Detection Agent     — score current quadrant, detect transitions
  2. Portfolio Rebalancing Agent — translate regime signal into position actions

SECONDARY
  3. EOD Position Monitor        — stop proximity + thesis-invalidation thresholds
  4. Event-Driven Alerts         — earnings pre-briefs, key yield threshold breaches
  5. Thesis Coherence Check      — pre-entry conflict analysis (CLI, on-demand)
  6. Primary Data Interpreter    — raw release interpretation through framework lens
```

### Design Principles

1. **Regime is the signal; price is the confirmation** — rebalancing decisions are regime-gated, not price-reactive
2. **Primary sources only** — no news APIs, no financial blogs as data inputs
3. **Thesis invalidation is mandatory** — every agent output must include the fastest path to being wrong
4. **Position time horizon determines monitoring frequency** — macro core positions reviewed weekly; speculative positions checked daily at EOD
5. **AI augments judgment, never replaces it** — all rebalancing suggestions require human confirmation before execution
6. **Reproducible state** — every agent run is logged with inputs, outputs, and timestamps

### Position Type Classification

Monitoring cadence and agent behavior are determined by `position_type` in `positions.json`:

| Type | Examples | Monitoring Cadence |
|---|---|---|
| `macro_core` | TLT, VGLT, SCHP, BRK-B | Regime-event-driven; weekly review |
| `macro_hedge` | ILF, SGOV | Weekly review; EOD if near stop |
| `speculative` | DUST, BTU, SM Energy | Daily EOD; hard deadline tracking |
| `equity_single` | ADBE, IBKR | EOD; earnings-event-driven |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                    │
│                                                                          │
│  ┌─── TYPESCRIPT ──────────────────────────────────────────┐  ┌──────────┐
│  │  FRED API │ BLS │ EIA │ Polygon.io                       │  │   IBKR   │
│  │  (axios, zod)                                           │  │   Flex   │
│  └────────────────────┬────────────────────────────────────┘  └────┬─────┘
│                       │ macro indicators (daily)                   │
└───────────────────────┼────────────────────────────────────────────┼─────┘
                        │                                            │
                        └──────────────┬─────────────────────────────┘
                                       │ unified JSON cache
                     ┌─────────────────▼───────────────────┐
                     │   REGIME DETECTION AGENT (TS)       │  ★ PRIMARY
                     │  macro data → quadrant score +       │
                     │  confidence + transition signals     │
                     └─────────────────┬───────────────────┘
                                       │ regimeLatest.json           │
                     ┌─────────────────▼───────────────────┐         │
                     │   REBALANCING AGENT (TypeScript)     │◄────────┘
                     │  regime + portfolio snapshot →       │ portfolio snapshot
                     │  alignment score + action list       │
                     └──────┬──────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────────┐
        │                   │                        │
┌───────▼────────┐  ┌───────▼──────────┐  ┌─────────▼──────────┐
│ Thesis         │  │ Data Interpreter │  │ EOD Monitor        │
│ Coherence      │  │ (on-demand)      │  │ (daily 4:15 PM ET) │
│ (CLI)          │  └───────┬──────────┘  └─────────┬──────────┘
└───────┬────────┘          │                       │
        └────────────────┬──┘                       │
                         │                          │
              ┌──────────▼──────────────────────────▼──────────┐
              │                 OUTPUT LAYER                    │
              │   Telegram Alerts │ SQLite Logs │ JSON Cache    │
              └─────────────────────────────────────────────────┘
```

### Unified TypeScript Architecture

| Responsibility | Language | Rationale |
|---|---|---|
| All AI agents (Regime, Rebalancing, etc.) | **TypeScript** | Native Gemini SDK; unified type safety with Zod |
| Data fetching (FRED, IBKR, Polygon) | **TypeScript** | Unified HTTP client (Axios); single runtime |
| EOD monitor + Telegram alerts | **TypeScript** | Co-located with data fetchers; efficient Event Loop |

**Pure TypeScript Monolith** — the entire intelligence and automation layer lives in a single Node.js/TypeScript runtime. This eliminates language boundaries, simplifies deployment, and ensures consistent type safety from data ingestion to AI output.

---

## 3. Tech Stack

| Component | Tool | Notes |
|---|---|---|
| **Language** | TypeScript 5.x | Node 20+ |
| **Package Manager**| pnpm | Efficient dependency management |
| **AI** | Google Gemini SDK | `@google/generative-ai` |
| **HTTP Client** | `axios` | Unified fetching for FRED, Polygon, IBKR |
| **XML Parsing** | `fast-xml-parser` | IBKR Flex XML → JSON |
| **Validation** | `zod` | Runtime schema validation for all inputs/outputs |
| **Scheduling** | `node-cron` | Regime cycle, digest, EOD check |
| **Persistence** | `better-sqlite3` | High-performance SQLite for agent runs and logs |
| **Env Management** | `dotenv` | |
| **Testing** | `vitest` | Modern test runner for units and integrations |
| **Transpiler** | `tsx` / `ts-node` | For running TypeScript directly |

---

## 4. Directory Structure

```
macro-investor-ai/
│
├── .env                                   # Secrets (never commit)
├── .env.example
├── README.md
├── package.json
├── tsconfig.json
├── GEMINI.md                              # AI-specific instructions
│
├── src/
│   ├── agents/
│   │   ├── baseAgent.ts                   # Gemini SDK wrapper + run logger
│   │   ├── regimeAgent.ts                 # ★ Agent 1: Regime Detection
│   │   ├── rebalancingAgent.ts            # ★ Agent 2: Portfolio Rebalancing
│   │   ├── coherenceAgent.ts              # Agent 3: Thesis Coherence (CLI)
│   │   └── interpreterAgent.ts            # Agent 4: Primary Data Interpreter
│   │
│   ├── data/
│   │   ├── fetchers/
│   │   │   ├── fredFetcher.ts             # FRED macro indicator series
│   │   │   ├── blsFetcher.ts              # BLS inflation/labor data
│   │   │   ├── eiaFetcher.ts              # EIA energy data
│   │   │   ├── polygonFetcher.ts          # EOD prices + earnings calendar
│   │   │   └── ibkrFetcher.ts             # IBKR Flex Web Service fetcher
│   │   ├── cache/
│   │   │   ├── macroSnapshot.json         # Latest macro values
│   │   │   ├── positionsSnapshot.json     # Latest IBKR positions
│   │   │   └── regimeLatest.json          # Last regime assessment
│   │   └── types.ts                       # Unified Zod schemas
│   │
│   ├── monitor/
│   │   └── eodMonitor.ts                  # EOD stop proximity + threshold checks
│   │
│   ├── prompts/
│   │   ├── regime_system.txt
│   │   ├── rebalancing_system.txt
│   │   ├── coherence_system.txt
│   │   └── interpreter_system.txt
│   │
│   ├── flows/
│   │   ├── regimeCycle.ts                 # ★ Flow 1: Regime update + rebalancing
│   │   ├── dailyDigest.ts                 # Flow 2: Morning digest
│   │   ├── eodCheck.ts                    # Flow 3: EOD monitor + alerts
│   │   └── eventPrebrief.ts               # Flow 4: Pre-earnings brief
│   │
│   ├── alerts/
│   │   └── telegramBot.ts                 # Telegraf bot + handlers
│   │
│   └── scheduler.ts                       # node-cron entry point
│
├── tests/                                 # Vitest test suites
├── config/
│   ├── positions.json                     # Manual portfolio state
│   └── regime_weights.json                # Indicator weights
└── logs/                                  # SQLite databases
```

---

### 5. Environment & Configuration

### `.env.example`

```dotenv
GEMINI_API_KEY=your_key_here

# Agent Models
REGIME_AGENT_MODEL=gemini-3-flash-preview
REBALANCING_AGENT_MODEL=gemini-3-flash-preview
COHERENCE_AGENT_MODEL=gemini-3-flash-preview
INTERPRETER_AGENT_MODEL=gemini-3-flash-preview

FRED_API_KEY=your_key_here
```


---

## 6. Module Specifications

### 6.1 Data Layer — REST APIs (TypeScript)

#### `src/data/fetchers/fredFetcher.ts`

**Responsibility:** Fetch and cache key macro indicator series from FRED.

```typescript
async function fetchSeries(seriesId: string, periods: number = 12): Promise<DataPoint[]>
async function fetchAll(): Promise<Record<string, DataPoint[]>>
async function getLatestValues(): Promise<Record<string, number>>
```

**Caching:** Write to `src/data/cache/macroSnapshot.json` with per-series timestamps.

#### `src/data/fetchers/blsFetcher.ts`

**Responsibility:** Fetch inflation (CPI) and labor (NFP) data from BLS.

#### `src/data/fetchers/eiaFetcher.ts`

**Responsibility:** Fetch energy price and inventory data from EIA.

#### `src/data/fetchers/polygonFetcher.ts`

**Responsibility:** Fetch EOD price data and earnings calendars.

---

### 6.2 Data Layer — IBKR Flex Reports (TypeScript)

#### `src/data/fetchers/ibkrFetcher.ts`

**Responsibility:** Fetch EOD portfolio snapshot from IBKR Flex Web Service.

```typescript
async function fetchPortfolioSnapshot(): Promise<PositionSnapshot[]>
```

**Output:** `src/data/cache/positionsSnapshot.json` includes `fetchedAt` for freshness verification.

---

### 6.3 Agent: Regime Detection Agent ★

**File:** `src/agents/regimeAgent.ts`
**Trigger:** Weekly + after major macro releases.
**Output cached to:** `src/data/cache/regimeLatest.json` + `logs/regime_history.db`

**Output:**
```json
{
  "quadrant":                    "Stagflation" | "Goldilocks" | "Inflationary Boom" | "Deflationary Recession",
  "confidence":                  0.0-100,
  "inflation_score":             0.0-1.0,
  "growth_score":                0.0-1.0,
  "regime_drift_vs_prior":       "Stable" | "Weakening" | "Transitioning" | "Shifted",
  "transition_signal":           "Warning of an impending shift, if any",
  "keyDrivers":                  ["Bullet points explaining classification"],
  "confirming_indicators":       ["List of confirming data points"],
  "contradicting_indicators":    ["List of contradicting data points"],
  "central_thesis_conflict":     "stagflation vs. deflation tension assessment",
  "fastest_path_to_being_wrong": "mandatory; single most plausible invalidation within 60 days",
  "watch_next":                  ["top 3 upcoming releases"],
  "evaluatedAt":                 "ISO timestamp"
}
```

**System prompt** (`src/prompts/regime_system.txt`):
*Classification of macro environment into Goldilocks, Inflationary Boom, Stagflation, or Deflationary Recession.*

**Key Constraints:**
- **Drift Detection:** Compare against `prior_assessment` to determine if the regime is stable or shifting.
- **Mandatory Invalidation:** Must identify the "fastest path to being wrong".
- **Central Thesis Conflict:** Must address the tension between stagflation (bearish nominal Treasuries) and deflationary recession (bullish nominal Treasuries).

---

### 6.4 Agent: Portfolio Rebalancing ★

**File:** `src/agents/rebalancingAgent.ts`
**Trigger:** Automatically after regime shift or on-demand via CLI.

**Output:**
```json
{
  "alignment_score":             0.0-1.0,
  "alignment_grade":             "A" | "B" | "C" | "D",
  "position_assessments": [
    {
      "symbol":           "string",
      "position_type":    "string",
      "regime_fit":       "Strong" | "Moderate" | "Weak" | "Misaligned",
      "thesis_intact":    true | false,
      "suggested_action": "Hold" | "Add" | "Trim" | "Exit" | "Watch",
      "action_rationale": "string",
      "urgency":          "None" | "This Week" | "Immediate",
      "conflict_flag":    "string | null"
    }
  ],
  "priority_actions":                  ["top 3 ranked by urgency"],
  "regime_transition_implication":     "what to pre-position for if regime is drifting",
  "thesis_conflict_resolution":        "explicit recommendation on stagflation vs. deflation",
  "rebalancing_rationale":             "overall narrative",
  "fastest_path_to_being_wrong":       "mandatory; rebalancing invalidation scenario",
  "evaluatedAt":                       "ISO timestamp"
}
```

**System prompt** (`src/prompts/rebalancing_system.txt`):
*Translate regime assessment into concrete, prioritized portfolio actions.*

**Key Constraints:**
- **Thesis Alignment:** Every "Exit" or "Trim" must reference the original thesis invalidation condition.
- **Position Standards:**
    - `macro_core`: Only action if regime shifted OR thesis-invalidation approaching.
    - `macro_hedge`: Hold unless regime contradicts.
    - `speculative`: Assess against hard deadline and current thesis validity.

---

### 6.5 Agent: Thesis Coherence

**File:** `src/agents/coherenceAgent.ts`
**Trigger:** On-demand CLI before new entries.

---

### 6.6 Agent: Primary Data Interpreter

**File:** `src/agents/interpreterAgent.ts`

---

### 6.7 EOD Position Monitor

**File:** `src/monitor/eodMonitor.ts`
**Trigger:** Daily 4:15 PM ET.

**Logic:**
1. **Stop Proximity:** Warn if within 3% of hard stop.
2. **Thesis Thresholds:** Monitor `macro_core` against underlying drivers (e.g., TLT against 30yr yield).
3. **Deadlines:** Warn if `speculative` deadline is within 5 days.

---

## 7. Configuration Files

### `config/regime_weights.json`
```json
{
  "inflation_indicators": {
    "cpi_yoy": 0.25, "pce_yoy": 0.20, "breakeven_5y5y": 0.20,
    "ppi_yoy": 0.15, "oil_price_3m_change": 0.10, "fertilizer_index_3m_change": 0.10
  },
  "growth_indicators": {
    "ism_manufacturing": 0.30, "ism_services": 0.20, "real_gdp_qoq": 0.25,
    "nfp_3m_avg": 0.15, "retail_sales_yoy": 0.10
  },
  "regime_thresholds": {
    "inflation_high": 0.60, "inflation_low": 0.40,
    "growth_high": 0.55, "growth_low": 0.45
  }
}
```

### `config/positions.json`
```json
{
  "SYMBOL": {
    "shares": 100,
    "avg_cost": 50.00,
    "position_type": "macro_core | macro_hedge | speculative | equity_single",
    "thesis": "string",
    "regime_match": ["Goldilocks", "..."],
    "stop": 45.00,
    "hard_stop": 40.00,
    "deadline": "YYYY-MM-DD",
    "thesis_invalidation": "condition description",
    "threshold_monitor": {
      "indicator": "yield_30y | breakeven_5y5y",
      "warn_at": 4.50,
      "hard_exit_at": 5.10
    }
  }
}
```

---

## 8. Scheduled Flows

*Flows are implemented as TypeScript functions in `src/flows/` and triggered by `src/scheduler.ts`.*

---

## 8. Data Schemas

*All schemas defined in `src/data/types.ts` using **Zod**.*

```typescript
export const PositionSnapshotSchema = z.object({
  symbol: z.string(),
  quantity: z.number(),
  avgCost: z.number(),
  marketPrice: z.number(),
  marketValue: z.number(),
  unrealizedPnl: z.number(),
  unrealizedPnlPct: z.number(),
  fetchedAt: z.string(),
});
```

---

## 9. Implementation Priorities

| Phase | Module | Language | Value Delivered |
|---|---|---|---|
| **1** | `fredFetcher.ts` + `regimeAgent.ts` | TypeScript | Core regime scoring operational |
| **2** | `rebalancingAgent.ts` | TypeScript | Portfolio recommendations live |
| **3** | `ibkrFetcher.ts` | TypeScript | Real portfolio state integration |
| **4** | `eodMonitor.ts` | TypeScript | Automated EOD risk monitoring |

---

## 10. Testing & Reliability Requirements

- **Unit Tests:** `vitest` for all fetchers and agents.
- **Validation:** Zod for all API responses and AI outputs.
- **Retries:** Axios interceptors for 5xx errors; Gemini SDK built-in retries.
- **Staleness:** Explicit `fetchedAt` checks in all JSON caches.

---
*Pure TypeScript Specifications — Version 2.0*
