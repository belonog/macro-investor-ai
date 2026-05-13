# Macro Investor AI System — Project Specifications

> **Purpose:** Automated, AI-augmented portfolio management system for a retail macro investor
> operating a growth/inflation regime framework.
> **Target runtime:** Local machine + cloud APIs
> **Primary AI:** Gemini API (claude-sonnet-4-20250514)
> **Brokerage:** Interactive Brokers (TWS API / Flex Reports)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Directory Structure](#4-directory-structure)
5. [Environment & Configuration](#5-environment--configuration)
6. [Module Specifications](#6-module-specifications)
   - 6.1 [Data Layer](#61-data-layer)
   - 6.2 [Automation Orchestrator](#62-automation-orchestrator)
   - 6.3 [Agent: Regime Detection](#63-agent-regime-detection)
   - 6.4 [Agent: Position Monitor](#64-agent-position-monitor)
   - 6.5 [Agent: Thesis Coherence](#65-agent-thesis-coherence)
   - 6.6 [Agent: Position Review](#66-agent-position-review)
   - 6.7 [Agent: Primary Data Interpreter](#67-agent-primary-data-interpreter)
   - 6.8 [Alert Delivery](#68-alert-delivery)
   - 6.9 [Trade & Decision Log](#69-trade--decision-log)
7. [Scheduled Flows](#7-scheduled-flows)
8. [Data Schemas](#8-data-schemas)
9. [Implementation Priorities](#9-implementation-priorities)
10. [Testing & Reliability Requirements](#10-testing--reliability-requirements)

---

## 1. Project Overview

### Goal

Build a layered AI system that:

- Automates data collection from primary macro sources (FRED, BLS, EIA)
- Monitors live portfolio state via IBKR integration
- Runs structured AI agents for regime detection, thesis validation, and risk audit
- Delivers actionable alerts via Telegram with zero dependency on financial media

### Design Principles

1. **Primary sources only** — no news APIs, no financial blogs as data inputs
2. **AI augments judgment, never replaces it** — all high-stakes decisions require human confirmation
3. **Thesis invalidation is as important as thesis confirmation** — every agent must surface the fastest path to being wrong
4. **Stops are the last line of defense** — automated monitoring must have < 5-minute latency during market hours
5. **Reproducible state** — every agent run is logged with inputs, outputs, and timestamps

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                           │
│  FRED API │ BLS Releases │ EIA API │ Polygon.io │ IBKR API  │
└─────────────────────┬───────────────────────────────────────┘
                      │ structured JSON
┌─────────────────────▼───────────────────────────────────────┐
│                   ORCHESTRATOR (scheduler.py)               │
│         Cron-based trigger → route to correct module        │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────┘
       │          │          │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼───────┐
│ Regime  │ │Position │ │Thesis  │ │Position│ │ Data      │
│Detection│ │Monitor  │ │Coherence│ │Review  │ │Interpreter│
│ Agent   │ │ Agent   │ │ Agent  │ │ Agent  │ │ Agent     │
└──────┬──┘ └────┬────┘ └───┬────┘ └───┬────┘ └───┬───────┘
       └─────────┴──────────┴──────────┴──────────┘
                             │ Gemini API calls
┌────────────────────────────▼────────────────────────────────┐
│                     OUTPUT LAYER                            │
│         Telegram Alerts │ Google Sheets Log │ Local JSON    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Component | Tool | Version / Notes |
|---|---|---|
| **Language** | Python | 3.11+ |
| **AI** | Google Gemini API | `gemini-3-flash-preview` |
| **Macro data** | `fredapi` Python library | FRED + St. Louis Fed |
| **Price/events** | Polygon.io REST API (now massive.com) | Free tier ($0/mo Basic) |
| **Brokerage** | `ib_insync` Python library | Connects to TWS/IB Gateway |
| **Scheduling** | APScheduler or cron | OS-level cron preferred |
| **Alerts** | `python-telegram-bot` | Async, v20+ |
| **Persistence** | SQLite (local) + Google Sheets API | SQLite for logs, Sheets for position table |
| **Env management** | `python-dotenv` | `.env` file |
| **HTTP** | `httpx` | Async-capable requests |
| **Data** | `pandas`, `numpy` | Standard analysis |
| **Testing** | `pytest` | Unit tests per module |

---

## 4. Directory Structure

```
macro-investor-ai/
│
├── .env                          # API keys and secrets (never commit)
├── .env.example                  # Template for setup
├── requirements.txt
├── README.md
│
├── config/
│   ├── positions.json            # Current portfolio state (manually maintained)
│   ├── theses.json               # Thesis per position + invalidation conditions
│   ├── regime_weights.json       # Indicator weights for regime scoring
│   └── schedule.yaml             # Flow schedule definitions
│
├── data/
│   ├── fetchers/
│   │   ├── fred_fetcher.py       # FRED API wrapper
│   │   ├── bls_fetcher.py        # BLS direct release parser
│   │   ├── eia_fetcher.py        # EIA API wrapper
│   │   ├── polygon_fetcher.py    # Price + earnings calendar
│   │   └── ibkr_fetcher.py       # IBKR TWS API via ib_insync
│   ├── cache/                    # Local JSON cache of latest fetches
│   └── releases/                 # Raw BLS/FRED release dumps (dated)
│
├── agents/
│   ├── base_agent.py             # Shared Gemini API call wrapper + logging
│   ├── regime_agent.py           # Agent 1: Regime Detection
│   ├── position_monitor.py       # Agent 2: Stop/target monitoring
│   ├── coherence_agent.py        # Agent 3: Thesis Coherence check
│   ├── review_agent.py           # Agent 4: Weekly Portfolio Review
│   └── interpreter_agent.py      # Agent 5: Primary Data Interpreter
│
├── prompts/
│   ├── regime_system.txt         # System prompt: Regime Detection Agent
│   ├── coherence_system.txt      # System prompt: Thesis Coherence Agent
│   ├── review_system.txt         # System prompt: Portfolio Review Agent
│   └── interpreter_system.txt    # System prompt: Data Interpreter Agent
│
├── flows/
│   ├── daily_digest.py           # Flow 1: Morning macro digest
│   ├── position_watch.py         # Flow 2: Intraday stop monitor
│   ├── event_prebrief.py         # Flow 3: Pre-earnings/event brief
│   └── weekly_review.py          # Flow 4: Weekly portfolio audit
│
├── alerts/
│   └── telegram_bot.py           # Telegram delivery layer
│
├── logs/
│   ├── agent_runs.db             # SQLite: all agent I/O logs
│   └── alerts_sent.db            # SQLite: alert history
│
├── scheduler.py                  # Entry point: APScheduler cron controller
└── tests/
    ├── test_fetchers.py
    ├── test_agents.py
    └── test_flows.py
```

---

## 5. Environment & Configuration

### `.env.example`

```dotenv
# Anthropic
ANTHROPIC_API_KEY=your_key_here

# FRED (free at fred.stlouisfed.org/docs/api)
FRED_API_KEY=your_key_here

# Polygon.io
POLYGON_API_KEY=your_key_here

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Google Sheets (service account JSON path)
GOOGLE_SHEETS_CREDENTIALS_PATH=./config/gsheets_service_account.json
GOOGLE_SHEETS_POSITION_LOG_ID=your_sheet_id

# IBKR TWS
IBKR_HOST=127.0.0.1
IBKR_PORT=7497         # 7497 = paper, 7496 = live
IBKR_CLIENT_ID=1

# EIA
EIA_API_KEY=your_key_here
```

### `config/positions.json` Schema

See [Data Schemas](#8-data-schemas) — Section 8.1.

### `config/regime_weights.json`

```json
{
  "inflation_indicators": {
    "cpi_yoy": 0.25,
    "pce_yoy": 0.20,
    "breakeven_5y5y": 0.20,
    "ppi_yoy": 0.15,
    "oil_price_3m_change": 0.10,
    "fertilizer_index_3m_change": 0.10
  },
  "growth_indicators": {
    "ism_manufacturing": 0.30,
    "ism_services": 0.20,
    "real_gdp_qoq": 0.25,
    "nfp_3m_avg": 0.15,
    "retail_sales_yoy": 0.10
  },
  "regime_thresholds": {
    "inflation_high": 0.60,
    "inflation_low": 0.40,
    "growth_high": 0.55,
    "growth_low": 0.45
  }
}
```

---

## 6. Module Specifications

---

### 6.1 Data Layer

#### `data/fetchers/fred_fetcher.py`

**Responsibility:** Fetch and cache key macro indicator series from FRED.

**Required series:**

```python
FRED_SERIES = {
    # Inflation
    "cpi_yoy":           "CPIAUCSL",
    "pce_yoy":           "PCEPI",
    "ppi_yoy":           "PPIACO",
    "breakeven_5y":      "T5YIE",
    "breakeven_5y5y":    "T5YIFR",
    # Growth
    "real_gdp":          "GDPC1",
    "ism_manufacturing": "MANEMP",    # proxy; use ISM direct if available
    "retail_sales":      "RSAFS",
    "nfp":               "PAYEMS",
    # Rates & Liquidity
    "fed_funds_rate":    "FEDFUNDS",
    "yield_10y":         "DGS10",
    "yield_30y":         "DGS30",
    "yield_2y":          "DGS2",
    "yield_curve_2s10":  "T10Y2Y",
    # Dollar & Liquidity
    "dxy_proxy":         "DTWEXBGS",   # trade-weighted dollar
    "m2":                "M2SL",
}
```

**Interface:**

```python
def fetch_series(series_id: str, periods: int = 12) -> pd.Series
def fetch_all() -> dict[str, pd.Series]
def get_latest_values() -> dict[str, float]   # most recent data point per series
```

**Caching:** Write latest fetch to `data/cache/fred_latest.json` with fetch timestamp. Stale threshold: 24 hours.

---

#### `data/fetchers/ibkr_fetcher.py`

**Responsibility:** Pull live portfolio state from IBKR TWS via `ib_insync`.

**Required outputs:**

```python
def get_portfolio_snapshot() -> list[PositionSnapshot]
# Returns: symbol, quantity, avg_cost, market_price, unrealized_pnl, market_value

def get_account_summary() -> AccountSummary
# Returns: net_liquidation, cash, buying_power, total_pnl
```

**Notes:**

- TWS or IB Gateway must be running locally
- Use paper account port (7497) for testing all flows before going live
- Reconnect logic required — TWS drops connections on API idle

---

#### `data/fetchers/polygon_fetcher.py`

**Responsibility:** EOD prices + earnings calendar for held symbols.

```python
def get_eod_prices(symbols: list[str]) -> dict[str, float]
def get_earnings_calendar(symbols: list[str], days_ahead: int = 7) -> list[EarningsEvent]
def get_price_history(symbol: str, days: int = 90) -> pd.DataFrame
```

---

### 6.2 Automation Orchestrator

#### `scheduler.py`

**Responsibility:** Central entry point. Reads `config/schedule.yaml` and registers all jobs.

```python
from apscheduler.schedulers.blocking import BlockingScheduler

scheduler = BlockingScheduler(timezone="America/New_York")

# Register flows here:
# scheduler.add_job(daily_digest.run, 'cron', hour=7, minute=0, day_of_week='mon-fri')
# scheduler.add_job(position_watch.run, 'interval', minutes=15, ...)
# etc.
```

**`config/schedule.yaml`:**

```yaml
flows:
  daily_digest:
    schedule: "cron"
    hour: 7
    minute: 0
    days: "mon-fri"

  position_watch:
    schedule: "interval"
    minutes: 15
    market_hours_only: true   # 09:30–16:00 ET

  event_prebrief:
    schedule: "cron"
    hour: 18
    minute: 0
    days: "sun-thu"
    lookahead_hours: 48

  weekly_review:
    schedule: "cron"
    day_of_week: "sun"
    hour: 10
    minute: 0
```

---

### 6.3 Agent: Regime Detection

**File:** `agents/regime_agent.py`
**Trigger:** Weekly (Sunday) + after any major macro release (CPI, NFP, GDP)
**Runtime:** ~30–60 seconds (Gemini API call)

**Input:**

```python
{
  "macro_snapshot": dict,        # output of fred_fetcher.get_latest_values()
  "regime_weights": dict,        # from config/regime_weights.json
  "prior_regime_assessment": str # last run's output, for continuity
}
```

**Output:**

```python
{
  "regime_quadrant": str,              # "Stagflation" | "Goldilocks" | "Inflationary Boom" | "Deflationary Recession"
  "confidence": float,                 # 0.0–1.0
  "inflation_score": float,
  "growth_score": float,
  "transition_risk": str,              # narrative on regime shift risk
  "key_confirming_indicators": list,
  "key_contradicting_indicators": list,
  "thesis_implications": str,          # implication for TLT/VGLT/stagflation book
  "fastest_path_to_being_wrong": str,  # explicit invalidation framing
  "watch_next": list                   # top 3 upcoming data releases to monitor
}
```

**System Prompt skeleton** (`prompts/regime_system.txt`):

```
You are a macro regime analyst. Your sole purpose is to classify the current
macroeconomic environment using a four-quadrant growth/inflation framework.

REGIME DEFINITIONS:
- Goldilocks: growth above trend, inflation below target
- Inflationary Boom: growth above trend, inflation above target
- Stagflation: growth below trend, inflation above target
- Deflationary Recession: growth below trend, inflation below target

CRITICAL INSTRUCTION:
You must be equally rigorous about identifying what CONTRADICTS the dominant
regime classification as what confirms it. The section "fastest_path_to_being_wrong"
is mandatory and must identify the single most plausible scenario that would
invalidate the current regime reading within the next 60 days.

CURRENT PORTFOLIO CONTEXT:
The investor holds long-duration Treasuries (TLT, VGLT) as a Deflationary
Recession thesis. They also hold stagflation hedges (SCHP, ILF, GLD).
The central unresolved tension is: stagflation narrative (bearish for nominal
Treasuries) vs. deflationary recession narrative (bullish for nominal Treasuries).
Your regime assessment must directly address which narrative the current data
favors, and how confident that signal is.

Respond ONLY in the JSON format specified. No preamble.
```

---

### 6.4 Agent: Position Monitor

**File:** `agents/position_monitor.py`
**Trigger:** Every 15 minutes during market hours
**Runtime:** < 5 seconds (no Gemini API call — pure logic)

**Logic:**

```python
def check_stops(portfolio: list[PositionSnapshot], positions_config: dict) -> list[Alert]:
    alerts = []
    for position in portfolio:
        config = positions_config.get(position.symbol)
        if not config:
            continue
        stop = config["stop"]
        target_1 = config.get("target_1")
        if position.market_price <= stop * 1.02:   # within 2% of stop
            alerts.append(Alert(
                level="WARNING",
                symbol=position.symbol,
                message=f"{position.symbol} within 2% of stop ${stop:.2f}. Current: ${position.market_price:.2f}"
            ))
        if position.market_price <= stop:
            alerts.append(Alert(
                level="CRITICAL",
                symbol=position.symbol,
                message=f"STOP BREACH: {position.symbol} at ${position.market_price:.2f} — stop ${stop:.2f}"
            ))
    return alerts
```

**Note:** This agent does NOT call Claude. Speed and reliability over intelligence. Claude is invoked separately in the weekly review for context on *whether* a stop should be adjusted.

---

### 6.5 Agent: Thesis Coherence

**File:** `agents/coherence_agent.py`
**Trigger:** On-demand (CLI invocation before any new position entry)
**Runtime:** ~20–40 seconds

**CLI usage:**

```bash
python -m agents.coherence_agent \
  --symbol "GLD" \
  --thesis "Adding gold as paper commodity exposure; stagflation hedge" \
  --size 500
```

**Input to Claude:**

```python
{
  "proposed_position": {
    "symbol": str,
    "thesis": str,
    "proposed_size_usd": float
  },
  "current_book": dict,           # full positions.json
  "current_regime": str,          # latest regime_agent output
  "macro_framework": str          # embedded in system prompt
}
```

**Output:**

```python
{
  "regime_match": str,            # "Strong" | "Moderate" | "Weak" | "Conflicting"
  "correlation_risk": str,        # narrative on overlap with existing positions
  "thesis_conflicts": list,       # explicit list of conflicts with current book
  "sizing_note": str,             # comment on proposed size vs. current exposure
  "verdict": str,                 # "Proceed" | "Reduce Size" | "Reconsider" | "Conflicts with core thesis"
  "key_questions_before_entry": list  # 3 questions the investor should answer before entering
}
```

---

### 6.6 Agent: Position Review

**File:** `agents/review_agent.py`
**Trigger:** Weekly (Sunday 10:00 AM)
**Runtime:** ~60–90 seconds

**Input:**

```python
{
  "portfolio_snapshot": list,     # from ibkr_fetcher
  "positions_config": dict,       # positions.json with theses + stops
  "regime_assessment": dict,      # latest regime_agent output
  "macro_snapshot": dict,         # latest FRED data
  "week_events": list             # upcoming earnings/events from polygon_fetcher
}
```

**Output per position:**

```python
{
  "symbol": str,
  "thesis_intact": bool,
  "stop_assessment": str,         # "Correctly placed" | "Review needed" | "Too tight" | "No longer at support"
  "regime_alignment": str,        # how well position fits current regime
  "action_item": str | None,      # concrete action if needed
  "urgency": str                  # "None" | "Watch" | "Act this week"
}
```

**Portfolio-level summary:**

```python
{
  "overall_thesis_coherence": str,
  "primary_risk": str,
  "suggested_priority_actions": list,  # ranked by urgency
  "regime_positioning_grade": str     # A/B/C/D — how well book is positioned for current regime
}
```

---

### 6.7 Agent: Primary Data Interpreter

**File:** `agents/interpreter_agent.py`
**Trigger:** On-demand (CLI); also triggered automatically post-BLS/BEA release

**CLI usage:**

```bash
# Pipe raw release data directly
python -m agents.interpreter_agent --release "CPI" --paste-mode

# Or point to a downloaded release file
python -m agents.interpreter_agent --release "NFP" --file data/releases/nfp_2026_05.txt
```

**System prompt structure:**

- Frames all interpretation through the investor's specific stagflation → deflationary recession transition thesis
- Asks Claude to produce three sections: (1) what this confirms, (2) what this contradicts, (3) what remains ambiguous
- Explicitly forbids consensus framing ("markets expected X") — only primary data interpretation

**Output:** Markdown-formatted brief, pushed to Telegram and logged locally.

---

### 6.8 Alert Delivery

**File:** `alerts/telegram_bot.py`

**Alert levels and formatting:**

```
🟢 INFO     — regime update, scheduled digest
🟡 WARNING  — position within 2% of stop, upcoming binary event
🔴 CRITICAL — stop breach, thesis invalidation signal detected
```

**Message format (CRITICAL example):**

```
🔴 STOP BREACH — TLT
━━━━━━━━━━━━━━━━━
Current:  $88.20
Stop:     $89.50
Thesis:   Long-duration Treasury recession play
Action:   Review exit — hard stop at $5.10 yield (~$87.xx)
━━━━━━━━━━━━━━━━━
[Run Review Agent]
```

**Telegram buttons (inline keyboard):** Each CRITICAL alert should include action buttons:

- `[Acknowledge]` — logs that alert was seen, suppresses re-alert for 30 min
- `[Run Review]` — triggers `review_agent.py` for that symbol and sends result

---

### 6.9 Trade & Decision Log

**File:** `logs/agent_runs.db` (SQLite)

**Tables:**

```sql
CREATE TABLE agent_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agent        TEXT NOT NULL,
  input_hash   TEXT,
  input_json   TEXT,
  output_json  TEXT,
  model        TEXT,
  tokens_used  INTEGER
);

CREATE TABLE alerts_sent (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  level        TEXT,
  symbol       TEXT,
  message      TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  ack_at       TIMESTAMP
);

CREATE TABLE decision_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  logged_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  symbol       TEXT,
  action       TEXT,   -- "BUY" | "SELL" | "HOLD" | "STOP_ADJUSTED"
  rationale    TEXT,
  regime_at_time TEXT,
  price        REAL,
  notes        TEXT
);
```

---

## 7. Scheduled Flows

### Flow 1: Daily Macro Digest (`flows/daily_digest.py`)

**Schedule:** 7:00 AM ET, Mon–Fri

```
1. fred_fetcher.get_latest_values()
2. polygon_fetcher.get_earnings_calendar(held_symbols, days_ahead=2)
3. regime_agent.run() [only if regime_stale > 7 days OR major release today]
4. Format digest: regime summary + today's events + any stop proximity warnings
5. telegram_bot.send(digest)
```

### Flow 2: Intraday Position Watch (`flows/position_watch.py`)

**Schedule:** Every 15 min, 9:30–16:00 ET, Mon–Fri

```
1. ibkr_fetcher.get_portfolio_snapshot()
2. position_monitor.check_stops(snapshot, positions_config)
3. For each alert: telegram_bot.send(alert)
4. Log to alerts_sent.db
```

### Flow 3: Event Pre-Brief (`flows/event_prebrief.py`)

**Schedule:** 6:00 PM ET, Sun–Thu (catches next 48h)

```
1. polygon_fetcher.get_earnings_calendar(held_symbols, days_ahead=2)
2. For each event: interpreter_agent.generate_prebrief(symbol, thesis, event)
3. telegram_bot.send(prebrief)
```

### Flow 4: Weekly Portfolio Review (`flows/weekly_review.py`)

**Schedule:** Sunday 10:00 AM ET

```
1. ibkr_fetcher.get_portfolio_snapshot()
2. fred_fetcher.fetch_all()
3. regime_agent.run()
4. review_agent.run(snapshot, regime, macro_data)
5. telegram_bot.send(full_review_report)
6. Log full output to agent_runs.db
```

---

## 8. Data Schemas

### 8.1 `config/positions.json`

```json
{
  "TLT": {
    "shares": 268,
    "avg_cost": 88.50,
    "thesis": "Long-duration Treasury recession play. Fed forced to cut as growth collapses.",
    "regime_match": ["Deflationary Recession"],
    "stop": 89.50,
    "hard_stop": 87.00,
    "targets": [95.00, 100.00],
    "thesis_invalidation": "30-year yield breaks above 5.10% on sustained basis; stagflation regime confirmed with no recession signal",
    "notes": "Trim trigger at 30yr yield ~4.50%. Hard exit ~5.10%."
  },
  "DUST": {
    "shares": 30,
    "avg_cost": 140.00,
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

*(Populate all positions using same schema.)*

---

### 8.2 `PositionSnapshot` dataclass

```python
@dataclass
class PositionSnapshot:
    symbol: str
    quantity: float
    avg_cost: float
    market_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    fetched_at: datetime
```

---

### 8.3 `Alert` dataclass

```python
@dataclass
class Alert:
    level: str          # "INFO" | "WARNING" | "CRITICAL"
    symbol: str | None
    message: str
    action: str | None
    created_at: datetime = field(default_factory=datetime.now)
```

---

## 9. Implementation Priorities

Build in this order — each phase is independently useful before the next is complete.

| Phase | Module | Value Delivered |
|---|---|---|
| **1 — Immediate** | `position_monitor.py` + Telegram alerts | Automated stop watching; eliminates manual monitoring |
| **2 — Week 1** | `fred_fetcher.py` + `regime_agent.py` | Objective regime scoring; replaces reliance on media framing |
| **3 — Week 1–2** | `event_prebrief.py` flow | Pre-earnings briefs for BTU, ADBE and future events |
| **4 — Week 2** | `review_agent.py` + weekly flow | Consistent structured weekly audit replacing ad-hoc reviews |
| **5 — Week 2–3** | `coherence_agent.py` (CLI) | Pre-entry thesis conflict check on all new positions |
| **6 — Week 3+** | `interpreter_agent.py` + BLS auto-trigger | Full primary data independence; no media required |

---

## 10. Testing & Reliability Requirements

### Unit Tests (`tests/`)

- `test_fetchers.py` — mock API responses; verify schema compliance on all fetchers
- `test_agents.py` — test agent logic with fixture inputs; verify output schema
- `test_flows.py` — integration tests with mocked external calls

### Reliability Standards

| Component | Requirement |
|---|---|
| Stop monitor | < 5 min latency during market hours |
| IBKR connection | Auto-reconnect on drop; alert if offline > 2 min |
| Gemini API calls | Retry 3× with exponential backoff on 5xx errors |
| FRED cache | Stale threshold 24h; alert if fetch fails |
| Telegram delivery | Confirm delivery; retry on failure; local fallback log |

### Data Validation

All fetcher outputs must be validated before passing to agents:

- No `None` or `NaN` for critical indicators (stop calculation, price check)
- Timestamp recency check — reject data older than defined stale threshold
- Schema validation using `pydantic` models on all inter-module data

### Paper Account Testing

Before connecting to the live IBKR account:

1. Run all flows against IBKR paper account (port 7497) for minimum 5 trading days
2. Verify all alerts fire correctly on simulated stop breaches
3. Verify regime agent output is stable across consecutive runs on same input

---

*Generated for Claude Code implementation. All API credentials must be stored in `.env` — never hardcoded.*
