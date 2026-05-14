# Phase 1: IBKR Position Monitor & Telegram Alerts Design

**Date:** 2026-05-13
**Status:** Approved

## 1. Overview
Implement the first phase of the Macro Investor AI system, focusing on automated portfolio monitoring and alerting. This phase provides immediate value by eliminating the need for manual price tracking against stop-losses.

## 2. Components

### 2.1 Environment & Configuration
*   **`.env`**: Store `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `IBKR_HOST`, `IBKR_PORT`, and `IBKR_CLIENT_ID`.
*   **`requirements.txt`**: Include `ib_insync`, `python-telegram-bot`, `python-dotenv`, `pandas`, `pydantic`.
*   **`config/positions.json`**: Initialized with TLT, GLD, SHY, and Cash.

### 2.2 Data Layer: `data/fetchers/ibkr_fetcher.py`
*   Connects to IBKR TWS/Gateway (default port 7497).
*   Implements `get_portfolio_snapshot()` returning `list[PositionSnapshot]`.
*   Handles connection retries.

### 2.3 Logic Layer: `agents/position_monitor.py`
*   Pure Python logic (no AI/Claude dependency for this phase).
*   Compares `PositionSnapshot` prices against `config/positions.json` stops.
*   Returns a list of `Alert` objects (INFO, WARNING, CRITICAL).

### 2.4 Alert Layer: `alerts/telegram_bot.py`
*   Async Telegram client.
*   Provides a standardized `send_alert(alert: Alert)` method.
*   Implements visual indicators (🔴/🟡/🟢) as per spec.

### 2.5 Orchestration: `flows/position_watch.py`
*   The entry point for the monitoring loop.
*   Periodically runs: Fetch -> Monitor -> Alert.

## 3. Data Schemas

### `PositionSnapshot` (Internal)
```python
class PositionSnapshot(BaseModel):
    symbol: str
    quantity: float
    avg_cost: float
    market_price: float
    market_value: float
    unrealized_pnl: float
```

### `Alert` (Internal)
```python
class Alert(BaseModel):
    level: str  # INFO, WARNING, CRITICAL
    symbol: str | None
    message: str
```

## 4. Success Criteria
1.  Successful connection to IBKR paper account.
2.  Accurate reading of current positions.
3.  Telegram alert triggered when a simulated price breach occurs.
4.  Logs created in `logs/alerts_sent.db`.

## 5. Implementation Steps
1.  Setup environment (`.env`, `requirements.txt`).
2.  Initialize `config/positions.json` and basic directory structure.
3.  Implement `telegram_bot.py` and verify message delivery.
4.  Implement `ibkr_fetcher.py` and verify portfolio reading.
5.  Implement `position_monitor.py` logic and unit tests.
6.  Tying it all together in `flows/position_watch.py`.
