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
   - 6.1 [Data Layer — Python](#61-data-layer--python)
   - 6.2 [Data Layer — TypeScript (IBKR)](#62-data-layer--typescript-ibkr)
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
  1. Regime Detection Engine     — score current quadrant, detect transitions
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
│  ┌─── PYTHON ──────────────────────────────┐  ┌─── TYPESCRIPT ───────┐  │
│  │  FRED API │ BLS │ EIA │ Polygon.io       │  │  IBKR Flex Reports   │  │
│  │  (fredapi, httpx, pandas)               │  │  (axios, xml parser) │  │
│  └────────────────────┬────────────────────┘  └──────────┬───────────┘  │
│                       │ macro indicators (daily)         │ EOD snapshot  │
└───────────────────────┼──────────────────────────────────┼──────────────┘
                        │                                  │
                        └──────────────┬───────────────────┘
                                       │ unified JSON cache
                     ┌─────────────────▼───────────────────┐
                     │        REGIME ENGINE (Python)        │  ★ PRIMARY
                     │  macro data → quadrant score +       │
                     │  confidence + transition signals     │
                     └─────────────────┬───────────────────┘
                                       │ regime_latest.json
                     ┌─────────────────▼───────────────────┐
                     │    REBALANCING AGENT (Python)        │  ★ PRIMARY
                     │  regime + portfolio snapshot →       │
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

### Hybrid Language Boundary

| Responsibility | Language | Rationale |
|---|---|---|
| IBKR Flex Reports (EOD snapshot) | **TypeScript** | Pure REST + XML; no Python lib needed |
| Telegram delivery (EOD alerts) | **TypeScript** | `telegraf` inline keyboards; co-located with Flex fetch |
| All AI agents | **Python** | Anthropic SDK + `pandas` data pipeline |
| Macro data fetching (FRED, BLS, EIA) | **Python** | `fredapi` ecosystem |
| EOD monitor + all flows | **Python** | Reads cached Flex output; consistent with agent layer |

**TypeScript footprint is intentionally lean** — two responsibilities only: Flex
Report fetching (once daily at 4 PM ET) and Telegram delivery for EOD alerts.
All intelligence lives in Python.

---

## 3. Tech Stack

### Python Service

| Component | Tool | Notes |
|---|---|---|
| **Language** | Python 3.11+ | |
| **AI** | Google Gemini API | `gemini-3-flash-preview` |
| **Macro data** | `fredapi` | FRED series fetching |
| **HTTP** | `httpx` | BLS, EIA, Polygon, Telegram Bot API |
| **Data** | `pandas`, `numpy` | Indicator calculation, time series |
| **Validation** | `pydantic` | Schema enforcement on all inter-module data |
| **Scheduling** | `APScheduler` | Regime cycle, digest, EOD check |
| **Persistence** | `sqlite3` (stdlib) | Agent runs, regime history, decision log |
| **Env** | `python-dotenv` | Shared `.env` with TS service |
| **Testing** | `pytest` | Unit + integration |

### TypeScript Service

| Component | Tool | Notes |
|---|---|---|
| **Language** | TypeScript 5.x, Node 20+ | |
| **IBKR** | IBKR Flex Web Service | Pure HTTPS; no gateway; no local process |
| **HTTP** | `axios` | Flex Report two-step request/download |
| **XML parsing** | `fast-xml-parser` | Flex XML → JSON |
| **Validation** | `zod` | Runtime schema validation on IBKR responses |
| **Scheduling** | `node-cron` | Single daily EOD job |
| **Alerts** | `telegraf` | Telegram bot with inline keyboard |
| **Env** | `dotenv` | Shared `.env` |
| **Testing** | `vitest` | Unit tests |

---

## 4. Directory Structure

```
macro-investor-ai/
│
├── .env                                   # Shared secrets (never commit)
├── .env.example
├── README.md
│
├── config/
│   ├── positions.json                     # Portfolio state + position types (manually maintained)
│   ├── regime_weights.json                # Indicator weights for regime scoring
│   └── schedule.yaml                      # Flow schedule definitions
│
├── python/
│   ├── requirements.txt
│   ├── scheduler.py                       # APScheduler entry point
│   │
│   ├── data/
│   │   ├── fetchers/
│   │   │   ├── fred_fetcher.py            # FRED macro indicator series
│   │   │   ├── bls_fetcher.py             # BLS direct release parser
│   │   │   ├── eia_fetcher.py             # EIA energy data
│   │   │   └── polygon_fetcher.py         # EOD prices + earnings calendar
│   │   ├── cache/
│   │   │   ├── macro_snapshot.json        # Latest FRED/BLS/EIA values + timestamps
│   │   │   ├── positions_snapshot.json    # Written by TS Flex fetcher; read by agents
│   │   │   └── regime_latest.json         # Last full regime assessment output
│   │   └── releases/                      # Raw dated BLS/FRED release dumps
│   │
│   ├── agents/
│   │   ├── base_agent.py                  # Gemini API wrapper + run logger
│   │   ├── regime_agent.py                # ★ Agent 1: Regime Detection
│   │   ├── rebalancing_agent.py           # ★ Agent 2: Portfolio Rebalancing
│   │   ├── coherence_agent.py             # Agent 3: Thesis Coherence (CLI)
│   │   └── interpreter_agent.py           # Agent 4: Primary Data Interpreter
│   │
│   ├── monitor/
│   │   └── eod_monitor.py                 # EOD stop proximity + threshold checks
│   │
│   ├── prompts/
│   │   ├── regime_system.txt
│   │   ├── rebalancing_system.txt
│   │   ├── coherence_system.txt
│   │   └── interpreter_system.txt
│   │
│   ├── flows/
│   │   ├── regime_cycle.py                # ★ Flow 1: Regime update + rebalancing report
│   │   ├── daily_digest.py                # Flow 2: Morning digest (no new Gemini call)
│   │   ├── eod_check.py                   # Flow 3: EOD monitor + alerts
│   │   └── event_prebrief.py              # Flow 4: Pre-earnings/data-release brief
│   │
│   └── tests/
│       ├── test_fetchers.py
│       ├── test_agents.py
│       └── test_flows.py
│
├── typescript/
│   ├── package.json
│   ├── tsconfig.json
│   │
│   ├── src/
│   │   ├── ibkr/
│   │   │   ├── flexReportFetcher.ts       # IBKR Flex Web Service → PositionSnapshot[]
│   │   │   └── types.ts                   # Zod schemas
│   │   ├── alerts/
│   │   │   └── telegramBot.ts             # Telegraf bot + inline keyboard handlers
│   │   ├── flows/
│   │   │   └── eodSnapshot.ts             # Daily Flex fetch → write cache
│   │   └── scheduler.ts                   # node-cron entry point (single job)
│   │
│   └── tests/
│       ├── flex.test.ts
│       └── alerts.test.ts
│
└── logs/
    ├── agent_runs.db                      # SQLite: all agent I/O
    ├── regime_history.db                  # SQLite: regime assessment time series
    ├── alerts_sent.db                     # SQLite: alert history
    └── decision_log.db                    # SQLite: trade/decision entries
```

---

## 5. Environment & Configuration

### `.env.example`

```dotenv
# Anthropic
ANTHROPIC_API_KEY=your_key_here

# FRED (free — fred.stlouisfed.org/docs/api)
FRED_API_KEY=your_key_here

# Polygon.io (EOD prices + earnings calendar)
POLYGON_API_KEY=your_key_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# IBKR Flex Web Service (read-only, no local process required)
# Setup: Account Management → Reports → Flex Queries → Create Query + Token
IBKR_FLEX_TOKEN=your_flex_token
IBKR_FLEX_REPORT_ID=your_report_id

# EIA
EIA_API_KEY=your_key_here
```

### `config/regime_weights.json`

```json
{
  "inflation_indicators": {
    "cpi_yoy":                    0.25,
    "pce_yoy":                    0.20,
    "breakeven_5y5y":             0.20,
    "ppi_yoy":                    0.15,
    "oil_price_3m_change":        0.10,
    "fertilizer_index_3m_change": 0.10
  },
  "growth_indicators": {
    "ism_manufacturing":  0.30,
    "ism_services":       0.20,
    "real_gdp_qoq":       0.25,
    "nfp_3m_avg":         0.15,
    "retail_sales_yoy":   0.10
  },
  "regime_thresholds": {
    "inflation_high": 0.60,
    "inflation_low":  0.40,
    "growth_high":    0.55,
    "growth_low":     0.45
  },
  "transition_sensitivity": 0.10
}
```

---

## 6. Module Specifications

---

### 6.1 Data Layer — Python

#### `python/data/fetchers/fred_fetcher.py`

**Responsibility:** Fetch and cache key macro indicator series from FRED.

```python
FRED_SERIES = {
    # Inflation
    "cpi_yoy":        "CPIAUCSL",
    "pce_yoy":        "PCEPI",
    "ppi_yoy":        "PPIACO",
    "breakeven_5y":   "T5YIE",
    "breakeven_5y5y": "T5YIFR",
    # Growth
    "real_gdp":       "GDPC1",
    "retail_sales":   "RSAFS",
    "nfp":            "PAYEMS",
    # Rates & Yield Curve
    "fed_funds":      "FEDFUNDS",
    "yield_2y":       "DGS2",
    "yield_10y":      "DGS10",
    "yield_30y":      "DGS30",
    "curve_2s10":     "T10Y2Y",
    # Dollar & Liquidity
    "dxy_proxy":      "DTWEXBGS",
    "m2":             "M2SL",
}

def fetch_series(series_id: str, periods: int = 12) -> pd.Series
def fetch_all() -> dict[str, pd.Series]
def get_latest_values() -> dict[str, float]
```

**Caching:** Write to `data/cache/macro_snapshot.json` with per-series timestamps.
Stale thresholds: 24h for daily series; 7 days for quarterly (GDP).

---

#### `python/data/fetchers/polygon_fetcher.py`

**Responsibility:** EOD prices for held symbols and earnings calendar.

```python
def get_eod_prices(symbols: list[str]) -> dict[str, float]
def get_earnings_calendar(symbols: list[str], days_ahead: int = 7) -> list[EarningsEvent]
```

**Scope note:** Polygon is used for EOD prices to support stop proximity checks and
yield threshold monitoring. It is not used for intraday prices.

---

### 6.2 Data Layer — TypeScript (IBKR)

#### `typescript/src/ibkr/flexReportFetcher.ts`

**Responsibility:** Fetch EOD portfolio snapshot from IBKR Flex Web Service.
Pure HTTPS — no local gateway, no session management, no re-authentication.

**One-time setup (IBKR Account Management):**

1. Reports → Flex Queries → Create New Query
2. Sections: `OpenPositions`, `AccountInformation`, `UnrealizedPnL`, Format: XML
3. Save → note **Report ID**
4. Settings → Flex Web Service → **Create Token**

**Implementation:**

```typescript
const FLEX_BASE =
  'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService';

async function requestReport(token: string, reportId: string): Promise<string> {
  const res = await axios.get(`${FLEX_BASE}.SendRequest`, {
    params: { t: token, q: reportId, v: 3 }
  });
  return extractReferenceCode(res.data);   // parse XML status response
}

async function downloadReport(token: string, refCode: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const res = await axios.get(`${FLEX_BASE}.GetStatement`, {
      params: { t: token, q: refCode, v: 3 }
    });
    if (!res.data.includes('Please wait')) return res.data;
    await sleep(3000);
  }
  throw new Error('Flex report timed out after 30s');
}

async function fetchPortfolioSnapshot(): Promise<PositionSnapshot[]>
// Full chain: requestReport → downloadReport → parseXml (fast-xml-parser)
//             → validate (Zod) → write to ../python/data/cache/positions_snapshot.json
```

**Output:** `data/cache/positions_snapshot.json` — always includes `fetchedAt`
so Python consumers can verify freshness before reading.

---

### 6.3 Agent: Regime Detection ★

**File:** `python/agents/regime_agent.py`
**Trigger:** Weekly (Sunday 9 AM ET) + after any major macro release (CPI, NFP, GDP, PCE)
**Output cached to:** `data/cache/regime_latest.json` + inserted into `regime_history.db`

**Input:**

```python
{
  "macro_snapshot":   dict,   # fred_fetcher.get_latest_values()
  "regime_weights":   dict,   # config/regime_weights.json
  "prior_assessment": dict,   # regime_latest.json — for drift detection
  "recent_releases":  list,   # BLS/EIA releases since last run
}
```

**Output:**

```python
{
  "regime_quadrant":             str,    # "Stagflation" | "Goldilocks" | "Inflationary Boom" | "Deflationary Recession"
  "confidence":                  float,  # 0.0–1.0
  "inflation_score":             float,
  "growth_score":                float,
  "regime_drift_vs_prior":       str,    # "Stable" | "Weakening" | "Transitioning" | "Shifted"
  "transition_risk":             str,    # narrative: probability + direction of next regime move
  "confirming_indicators":       list,
  "contradicting_indicators":    list,
  "central_thesis_conflict":     str,    # stagflation vs. deflation tension assessment
  "fastest_path_to_being_wrong": str,    # mandatory; single most plausible invalidation within 60 days
  "watch_next":                  list,   # top 3 upcoming releases most likely to shift the reading
  "assessed_at":                 str,    # ISO timestamp
}
```

**System prompt** (`python/prompts/regime_system.txt`):

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

PORTFOLIO CONTEXT:
The investor holds long-duration Treasuries (TLT, VGLT) as a Deflationary
Recession thesis and stagflation hedges (SCHP, ILF, BTU). The unresolved
central tension: stagflation (bearish nominal Treasuries) vs. deflationary
recession (bullish nominal Treasuries). "central_thesis_conflict" must
directly address which narrative the current data favors and with what
confidence.

A secondary structural risk — petrodollar erosion / dollar debasement —
may invalidate nominal Treasury longs independently of the growth/inflation
quadrant. Flag explicitly if current indicators support it.

Respond ONLY in the specified JSON format. No preamble.
```

---

### 6.4 Agent: Portfolio Rebalancing ★

**File:** `python/agents/rebalancing_agent.py`
**Trigger:** Automatically after every `regime_agent` run where `regime_drift_vs_prior`
is `"Transitioning"` or `"Shifted"`; also on-demand via CLI

```bash
python -m agents.rebalancing_agent --full-report
```

**Input:**

```python
{
  "regime_assessment":  dict,   # full regime_agent output
  "portfolio_snapshot": list,   # PositionSnapshot[] from positions_snapshot.json
  "positions_config":   dict,   # config/positions.json (theses, stops, types, thresholds)
  "macro_snapshot":     dict,   # supporting context
}
```

**Output:**

```python
{
  "regime_portfolio_alignment_score": float,   # 0.0–1.0
  "alignment_grade":                  str,     # "A" | "B" | "C" | "D"
  "position_assessments": [
    {
      "symbol":           str,
      "position_type":    str,
      "regime_fit":       str,    # "Strong" | "Moderate" | "Weak" | "Misaligned"
      "thesis_intact":    bool,
      "suggested_action": str,    # "Hold" | "Add" | "Trim" | "Exit" | "Watch"
      "action_rationale": str,
      "urgency":          str,    # "None" | "This Week" | "Immediate"
      "conflict_flag":    str | None,
    }
  ],
  "priority_actions":                  list,   # top 3, ranked by urgency + portfolio impact
  "regime_transition_implication":     str,    # what to pre-position for if regime is drifting
  "thesis_conflict_resolution":        str,    # explicit recommendation on stagflation vs. deflation tension
  "rebalancing_rationale":             str,    # overall narrative tying regime to book
  "fastest_path_to_being_wrong":       str,    # mandatory; rebalancing invalidation scenario
}
```

**System prompt** (`python/prompts/rebalancing_system.txt`):

```
You are a portfolio construction analyst for a macro regime investor.
Translate a regime assessment into concrete, prioritized portfolio actions
grounded in the investor's existing positions and stated theses.

CRITICAL CONSTRAINTS:
1. You suggest actions; the investor executes. Never imply automation.
2. Every "Exit" or "Trim" must reference the original thesis invalidation
   condition from positions_config, not just a price level.
3. Thesis conflicts between positions must be surfaced explicitly in
   "thesis_conflict_resolution".
4. "fastest_path_to_being_wrong" on the rebalancing itself is mandatory.

STANDARDS BY POSITION TYPE:
- macro_core:    Only suggest action if regime has shifted quadrant OR
                 thesis-invalidation threshold is approaching
- macro_hedge:   Assess relative to regime; hold unless regime contradicts
- speculative:   Assess against hard deadline and current thesis validity;
                 time decay of thesis is a valid exit reason
- equity_single: Flag earnings risk; assess macro tailwind vs. headwind

Respond ONLY in the specified JSON format. No preamble.
```

---

### 6.5 Agent: Thesis Coherence

**File:** `python/agents/coherence_agent.py`
**Trigger:** On-demand CLI — run before every new position entry

```bash
python -m agents.coherence_agent \
  --symbol "GLD" \
  --thesis "Adding gold as stagflation hedge; paper commodity exposure" \
  --size 500
```

**Output:**

```python
{
  "regime_match":           str,    # "Strong" | "Moderate" | "Weak" | "Conflicting"
  "correlation_risk":       str,
  "thesis_conflicts":       list,
  "sizing_note":            str,
  "verdict":                str,    # "Proceed" | "Reduce Size" | "Reconsider" | "Conflicts"
  "questions_before_entry": list,   # 3 questions to answer before executing
}
```

---

### 6.6 Agent: Primary Data Interpreter

**File:** `python/agents/interpreter_agent.py`
**Trigger:** On-demand CLI + auto-triggered after major BLS/BEA/EIA releases

```bash
python -m agents.interpreter_agent --release "CPI" --paste-mode
python -m agents.interpreter_agent --release "NFP" --file data/releases/nfp_2026_05.txt
```

**Output — three mandatory sections:**

1. What this data **confirms** about the current regime reading
2. What this data **contradicts** about the current regime reading
3. What remains **ambiguous** and which upcoming release would resolve it

**System prompt constraint:** Explicitly prohibits consensus framing
("markets expected X, actual was Y"). Interpretation uses primary data values
only, through the investor's thesis lens.

Markdown output delivered to Telegram and logged locally.

---

### 6.7 EOD Position Monitor

**File:** `python/monitor/eod_monitor.py`
**Trigger:** Daily 4:15 PM ET, Mon–Fri — **no Gemini API call**

**Two check types:**

**1. Stop proximity** (all position types):

```python
def check_stop_proximity(
    eod_prices: dict[str, float],
    positions_config: dict,
    warning_pct: float = 0.03       # warn if within 3% of stop
) -> list[Alert]
```

**2. Thesis-invalidation thresholds** (macro_core only):

```python
# TLT/VGLT monitored via 30yr yield, not ETF price
THRESHOLD_MONITORS = {
    "TLT":  {"indicator": "yield_30y", "warn_at": 4.50, "hard_exit_at": 5.10},
    "VGLT": {"indicator": "yield_30y", "warn_at": 4.50, "hard_exit_at": 5.10},
}

def check_thesis_thresholds(
    current_indicators: dict[str, float],
    threshold_monitors: dict
) -> list[Alert]
```

**Design rationale:** Macro core positions are monitored against their
thesis-invalidation indicator (30yr yield), not the ETF price. The alert fires
when the underlying thesis driver approaches its invalidation level — keeping
monitoring regime-aligned rather than price-reactive.

**Speculative deadline check:**

```python
def check_deadlines(
    positions_config: dict,
    warn_days_ahead: int = 5
) -> list[Alert]
# Fires WARNING if speculative position deadline within 5 days
```

---

### 6.8 Orchestrators

#### `python/scheduler.py`

```python
from apscheduler.schedulers.blocking import BlockingScheduler

scheduler = BlockingScheduler(timezone="America/New_York")

# ★ Regime cycle: weekly + post-major-release
scheduler.add_job(regime_cycle.run, 'cron',
                  day_of_week='sun', hour=9, minute=0)

# Daily digest: weekday mornings (reads cache, no new Gemini call)
scheduler.add_job(daily_digest.run, 'cron',
                  day_of_week='mon-fri', hour=7, minute=0)

# EOD monitor: 15 min after close (after TS snapshot at 4:00 PM)
scheduler.add_job(eod_check.run, 'cron',
                  day_of_week='mon-fri', hour=16, minute=15)

# Event pre-brief: check upcoming events each evening
scheduler.add_job(event_prebrief.run, 'cron',
                  day_of_week='sun-thu', hour=18, minute=0)
```

#### `typescript/src/scheduler.ts`

```typescript
// Single responsibility: trigger daily EOD Flex snapshot
cron.schedule('0 16 * * 1-5', async () => {   // 4:00 PM ET weekdays
  await eodSnapshot.run();
  // Writes to data/cache/positions_snapshot.json
  // Python EOD monitor reads this file 15 min later at 4:15 PM
});
```

**Sequencing:** TS writes snapshot at 4:00 PM; Python monitor reads at 4:15 PM.
15-minute gap ensures the snapshot is fresh when the monitor consumes it.

---

### 6.9 Alert Delivery

Telegram is the single delivery channel. Both services send directly to the same
bot token — no cross-service calls needed.

**Alert levels:**

```
🟢 INFO     — regime update (stable), weekly digest, no action required
🟡 WARNING  — position within 3% of stop, yield threshold within 25bp of warn level,
              binary event within 48h, speculative deadline within 5 days
🔴 CRITICAL — stop breach (EOD), thesis-invalidation threshold breached,
              regime has shifted quadrant
```

**Rebalancing report format** (primary weekly output):

```
🟢 REGIME REPORT — Sunday May 18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Regime:     Stagflation → Drifting (confidence: 71%)
Drift:      Weakening — Deflationary Recession signal building
Alignment:  B  (portfolio 68% regime-aligned)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIORITY ACTIONS:
1. [TRIM — This Week]  SM Energy: resolve oil/Treasury thesis conflict
2. [WATCH]             TLT: 30yr yield 4.73% — warn level 4.50% already breached
3. [HOLD]              SCHP: strong stagflation alignment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fastest path to being wrong:
ISM Services re-accelerates above 55, removing recession signal and
re-anchoring inflation expectations upward.
[View Full Report]
```

**Inline keyboard buttons on CRITICAL alerts:**

- `[Acknowledge]` — suppresses re-alert for 60 min; logs acknowledgment time
- `[Run Rebalancing]` — triggers `rebalancing_agent.py` on-demand; returns output to Telegram

---

### 6.10 Decision Log

**SQLite schema** (shared across `logs/*.db`):

```sql
-- logs/agent_runs.db
CREATE TABLE agent_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agent        TEXT NOT NULL,      -- "regime" | "rebalancing" | "coherence" | "interpreter"
  trigger      TEXT,               -- "scheduled" | "post_release" | "manual"
  input_hash   TEXT,
  input_json   TEXT,
  output_json  TEXT,
  model        TEXT,
  tokens_used  INTEGER
);

-- logs/regime_history.db
CREATE TABLE regime_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  assessed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quadrant        TEXT,
  confidence      REAL,
  inflation_score REAL,
  growth_score    REAL,
  drift           TEXT,
  full_output     TEXT    -- full JSON for replay
);

-- logs/alerts_sent.db
CREATE TABLE alerts_sent (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  level        TEXT,
  symbol       TEXT,
  message      TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  ack_at       TIMESTAMP
);

-- logs/decision_log.db
CREATE TABLE decision_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  symbol         TEXT,
  action         TEXT,    -- "BUY" | "SELL_PARTIAL" | "SELL_FULL" | "HOLD" | "STOP_ADJUSTED"
  rationale      TEXT,
  regime_at_time TEXT,
  price          REAL,
  notes          TEXT
);
```

**`regime_history` purpose:** Enables regime drift analysis over time — tracking
how quadrant scores move across sessions to distinguish persistent transitions
from noise. Feeds the `regime_drift_vs_prior` comparison in each new regime run.

---

## 7. Scheduled Flows

### Flow 1: Regime Cycle (`python/flows/regime_cycle.py`) ★ Primary

**Schedule:** Sunday 9:00 AM ET + after any major macro release

```
1. fred_fetcher.fetch_all()
2. bls_fetcher.get_latest_releases()
3. eia_fetcher.get_latest()
4. regime_agent.run(macro_snapshot, prior_assessment=regime_latest.json)
   → write output to data/cache/regime_latest.json
   → insert row into regime_history.db

5. IF regime_drift_vs_prior IN ["Transitioning", "Shifted"]:
     Load positions_snapshot.json
     rebalancing_agent.run(regime, snapshot, positions_config)
     → Send full rebalancing report to Telegram
        (🔴 CRITICAL if "Shifted"; 🟡 WARNING if "Transitioning")
   ELSE:
     Send brief regime update (🟢 INFO — regime stable, no action required)

6. Log full run to agent_runs.db
```

---

### Flow 2: Daily Digest (`python/flows/daily_digest.py`)

**Schedule:** 7:00 AM ET, Mon–Fri

```
1. Read data/cache/regime_latest.json  — no new Gemini call unless stale > 7 days
2. polygon_fetcher.get_earnings_calendar(held_symbols, days_ahead=1)
3. Quick freshness check on yield_30y and breakeven_5y5y from FRED
4. Format and send Telegram digest:
   - Current regime quadrant + confidence + assessed date
   - Any indicators that moved > threshold since prior day
   - Today's earnings or economic events for held symbols
```

---

### Flow 3: EOD Snapshot + Monitor

**TypeScript 4:00 PM ET → Python 4:15 PM ET, Mon–Fri**

```
TypeScript (eodSnapshot.ts):
1. flexReportFetcher.fetchPortfolioSnapshot()
2. Validate with Zod; reject and alert if malformed
3. Write to data/cache/positions_snapshot.json with fetchedAt timestamp

Python (eod_check.py):
1. Read positions_snapshot.json — verify fetchedAt < 20 min
2. polygon_fetcher.get_eod_prices(held_symbols)
3. eod_monitor.check_stop_proximity(eod_prices, positions_config)
4. eod_monitor.check_thesis_thresholds(latest_indicators, threshold_monitors)
5. eod_monitor.check_deadlines(positions_config)
6. Send each alert via Telegram Bot API
7. Log to alerts_sent.db
```

---

### Flow 4: Event Pre-Brief (`python/flows/event_prebrief.py`)

**Schedule:** 6:00 PM ET, Sun–Thu

```
1. polygon_fetcher.get_earnings_calendar(held_symbols, days_ahead=2)
2. For each event in next 48h:
   interpreter_agent.generate_prebrief(symbol, thesis, event_details)
3. Send prebrief via Telegram (🟡 WARNING level)
```

---

### On-Demand: Manual Rebalancing Report

```bash
python -m agents.rebalancing_agent --full-report
```

Pulls `regime_latest.json` + `positions_snapshot.json`, runs rebalancing agent,
sends full report to Telegram, logs to `agent_runs.db`.

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

*(Populate all positions. `position_type` is required — used by rebalancing agent and EOD monitor.)*

---

### 8.2 `PositionSnapshot`

**TypeScript canonical** (`typescript/src/ibkr/types.ts`):

```typescript
const PositionSnapshotSchema = z.object({
  symbol:           z.string(),
  quantity:         z.number(),
  avgCost:          z.number(),
  marketPrice:      z.number(),    // prior close from Flex Report
  marketValue:      z.number(),
  unrealizedPnl:    z.number(),
  unrealizedPnlPct: z.number(),
  fetchedAt:        z.string(),    // ISO string; Python parses to datetime
});
type PositionSnapshot = z.infer<typeof PositionSnapshotSchema>;
```

**Python equivalent** (for agent consumption after reading cache):

```python
@dataclass
class PositionSnapshot:
    symbol:             str
    quantity:           float
    avg_cost:           float
    market_price:       float
    market_value:       float
    unrealized_pnl:     float
    unrealized_pnl_pct: float
    fetched_at:         datetime
```

---

### 8.3 `RegimeAssessment` (cached as `regime_latest.json`)

```python
@dataclass
class RegimeAssessment:
    regime_quadrant:             str
    confidence:                  float
    inflation_score:             float
    growth_score:                float
    regime_drift_vs_prior:       str
    transition_risk:             str
    confirming_indicators:       list[str]
    contradicting_indicators:    list[str]
    central_thesis_conflict:     str
    fastest_path_to_being_wrong: str
    watch_next:                  list[str]
    assessed_at:                 datetime
```

---

## 9. Implementation Priorities

| Phase | Module | Language | Value Delivered |
|---|---|---|---|
| **1** | `fred_fetcher.py` + `regime_agent.py` + `regime_cycle.py` | Python | ★ Core engine live; weekly regime scoring operational |
| **2** | `rebalancing_agent.py` | Python | ★ Regime → actionable portfolio recommendations |
| **3** | `flexReportFetcher.ts` + `eodSnapshot.ts` | TypeScript | Real portfolio state feeds rebalancing agent |
| **4** | `eod_monitor.py` + `eod_check.py` | Python | EOD stop proximity + yield threshold alerts |
| **5** | `event_prebrief.py` + `interpreter_agent.py` | Python | Event pre-briefs; primary data interpretation |
| **6** | `coherence_agent.py` (CLI) | Python | Pre-entry thesis conflict check |

**Phase 1 note:** The regime engine can be fully built and backtested before any
IBKR integration exists. Feed 12 months of historical FRED data through
`regime_agent` in sequence and verify quadrant classifications match your own
prior readings. Tune `regime_weights.json` until scoring aligns with your
framework before connecting any live data.

---

## 10. Testing & Reliability Requirements

### Unit Tests

**Python (`python/tests/`):**

- `test_fetchers.py` — mock FRED/Polygon responses; verify schema compliance and cache writes
- `test_agents.py` — fixture inputs for regime and rebalancing agents; verify output schema; test regime scoring against known historical data; verify rebalancing logic produces correct verdicts for each position type
- `test_flows.py` — integration tests with mocked external calls and file I/O

**TypeScript (`typescript/tests/`):**

- `flex.test.ts` — mock Flex XML responses; verify Zod parsing + rejection of malformed data; test two-step request/download retry logic
- `alerts.test.ts` — verify Telegram message formatting and alert level routing

### Reliability Standards

| Component | Requirement |
|---|---|
| Regime agent | Pydantic schema validation on output before caching; Telegram alert if run fails |
| Rebalancing agent | Requires regime assessment `assessed_at` < 7 days; reject stale input |
| Flex snapshot | Stale threshold: 26 hours; Python EOD monitor skips and alerts if snapshot older than 20 min at run time |
| Gemini API | Retry 3× with exponential backoff on 5xx; log all failures to `agent_runs.db` |
| FRED cache | 24h stale threshold; alert if fetch fails before regime cycle run |
| Telegram | Retry on delivery failure; log locally after 3 failed attempts |

### Data Validation

- **TypeScript:** Zod parse failures on Flex data → logged + Telegram WARNING; never silently swallowed
- **Python:** Pydantic models on all inter-module data; reject `None`/`NaN` on any field passed to agent prompts
- All cache files include per-field timestamps; all consumers check staleness before reading

### Backtesting the Regime Engine (Required Before Production)

Before using regime output to inform real portfolio decisions:

1. Feed 12 months of historical FRED data through `regime_agent` in sequence
2. Compare classifications against your own prior readings for the same periods
3. Verify `central_thesis_conflict` correctly identifies the stagflation vs. deflation tension across different data environments
4. Tune `regime_weights.json` until scoring matches your framework intuition on known historical regimes (e.g. 2022 stagflation period, late 2023 soft-landing period)

---

*Generated for Claude Code implementation. All API credentials must be stored in `.env` — never hardcoded.*
