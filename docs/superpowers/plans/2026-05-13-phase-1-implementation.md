# Phase 1: IBKR Position Monitor & Telegram Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated portfolio monitoring with IBKR integration and Telegram alerts for stop-loss breaches.

**Architecture:** A periodic flow (`position_watch.py`) that fetches live data from IBKR (`ibkr_fetcher.py`), evaluates it against a static configuration (`position_monitor.py`), and sends alerts via a Telegram bot service (`telegram_bot.py`).

**Tech Stack:** Python 3.11+, `ib_insync`, `python-telegram-bot`, `pydantic`, `sqlite3`, `pytest`.

---

### Task 1: Project Initialization & Directory Structure

**Files:**
- Create: `config/positions.json`
- Create: `data/fetchers/__init__.py`
- Create: `agents/__init__.py`
- Create: `alerts/__init__.py`
- Create: `flows/__init__.py`
- Create: `logs/.gitkeep`

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p config data/fetchers agents alerts flows logs tests`

- [ ] **Step 2: Initialize config/positions.json**

```json
{
  "TLT": {
    "shares": 100,
    "avg_cost": 90.00,
    "stop": 88.00,
    "thesis": "Long-duration Treasury play"
  },
  "GLD": {
    "shares": 50,
    "avg_cost": 200.00,
    "stop": 195.00,
    "thesis": "Stagflation hedge"
  },
  "SHY": {
    "shares": 200,
    "avg_cost": 82.00,
    "stop": 81.50,
    "thesis": "Short-term treasury cash proxy"
  },
  "CASH": {
    "shares": 0,
    "avg_cost": 1.00,
    "stop": 0.00,
    "thesis": "Cash balance"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add config/positions.json
git commit -m "chore: initialize project structure and positions config"
```

---

### Task 2: Telegram Bot Service

**Files:**
- Create: `alerts/telegram_bot.py`
- Test: `tests/test_telegram.py`

- [ ] **Step 1: Write failing test for Telegram formatting**

```python
import pytest
from alerts.telegram_bot import format_alert
from agents.position_monitor import Alert

def test_format_alert_critical():
    alert = Alert(level="CRITICAL", symbol="TLT", message="STOP BREACH: TLT at $87.50 — stop $88.00")
    formatted = format_alert(alert)
    assert "🔴 STOP BREACH — TLT" in formatted
    assert "Current:  $87.50" in formatted # This is a placeholder for expected formatting
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_telegram.py`
Expected: FAIL (Module not found)

- [ ] **Step 3: Implement Telegram Bot Service**

```python
import os
import asyncio
from telegram import Bot
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

class Alert(BaseModel):
    level: str
    symbol: str | None
    message: str

def format_alert(alert: Alert) -> str:
    emoji = {"INFO": "🟢", "WARNING": "🟡", "CRITICAL": "🔴"}.get(alert.level, "⚪")
    header = f"{emoji} {alert.level} — {alert.symbol}" if alert.symbol else f"{emoji} {alert.level}"
    return f"{header}\n━━━━━━━━━━━━━━━━━\n{alert.message}\n━━━━━━━━━━━━━━━━━"

async def send_telegram_alert(alert: Alert):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print(f"Telegram not configured. Alert: {alert.message}")
        return
    bot = Bot(token=token)
    await bot.send_message(chat_id=chat_id, text=format_alert(alert))
```

- [ ] **Step 4: Run test to verify formatting passes**

Run: `pytest tests/test_telegram.py`

- [ ] **Step 5: Commit**

```bash
git add alerts/telegram_bot.py tests/test_telegram.py
git commit -m "feat: add telegram bot service and formatting"
```

---

### Task 3: IBKR Fetcher

**Files:**
- Create: `data/fetchers/ibkr_fetcher.py`
- Test: `tests/test_ibkr_fetcher.py`

- [ ] **Step 1: Define PositionSnapshot and IBKR Fetcher interface**

```python
from pydantic import BaseModel
from datetime import datetime

class PositionSnapshot(BaseModel):
    symbol: str
    quantity: float
    avg_cost: float
    market_price: float
    market_value: float
    unrealized_pnl: float
    fetched_at: datetime = datetime.now()

class IBKRFetcher:
    def __init__(self, host='127.0.0.1', port=7497, client_id=1):
        self.host = host
        self.port = port
        self.client_id = client_id

    def get_portfolio_snapshot(self) -> list[PositionSnapshot]:
        # Implementation using ib_insync
        pass
```

- [ ] **Step 2: Implement IBKR Fetcher**

```python
from ib_insync import IB, Stock, util
import os

class IBKRFetcher:
    def __init__(self, host=None, port=None, client_id=None):
        self.host = host or os.getenv("IBKR_HOST", "127.0.0.1")
        self.port = int(port or os.getenv("IBKR_PORT", 7497))
        self.client_id = int(client_id or os.getenv("IBKR_CLIENT_ID", 1))
        self.ib = IB()

    def connect(self):
        if not self.ib.isConnected():
            self.ib.connect(self.host, self.port, clientId=self.client_id)

    def disconnect(self):
        self.ib.disconnect()

    def get_portfolio_snapshot(self) -> list[PositionSnapshot]:
        self.connect()
        positions = self.ib.positions()
        snapshots = []
        for p in positions:
            if isinstance(p.contract, Stock):
                # Get market price (requires ticker)
                ticker = self.ib.reqTickers(p.contract)[0]
                market_price = ticker.marketPrice() if ticker.marketPrice() == ticker.marketPrice() else 0.0
                
                snapshots.append(PositionSnapshot(
                    symbol=p.contract.symbol,
                    quantity=p.position,
                    avg_cost=p.avgCost,
                    market_price=market_price,
                    market_value=p.position * market_price,
                    unrealized_pnl=(market_price - p.avgCost) * p.position
                ))
        return snapshots
```

- [ ] **Step 3: Commit**

```bash
git add data/fetchers/ibkr_fetcher.py
git commit -m "feat: add ibkr fetcher with ib_insync"
```

---

### Task 4: Position Monitor Logic

**Files:**
- Create: `agents/position_monitor.py`
- Test: `tests/test_monitor.py`

- [ ] **Step 1: Write failing test for stop checking**

```python
from agents.position_monitor import check_stops
from data.fetchers.ibkr_fetcher import PositionSnapshot
import json

def test_check_stops_breach():
    snapshot = [PositionSnapshot(symbol="TLT", quantity=100, avg_cost=90, market_price=87, market_value=8700, unrealized_pnl=-300)]
    config = {"TLT": {"stop": 88}}
    alerts = check_stops(snapshot, config)
    assert len(alerts) == 1
    assert alerts[0].level == "CRITICAL"
```

- [ ] **Step 2: Implement check_stops**

```python
def check_stops(portfolio: list[PositionSnapshot], positions_config: dict) -> list[Alert]:
    alerts = []
    for position in portfolio:
        config = positions_config.get(position.symbol)
        if not config:
            continue
        stop = config["stop"]
        if position.market_price <= stop:
            alerts.append(Alert(
                level="CRITICAL",
                symbol=position.symbol,
                message=f"STOP BREACH: {position.symbol} at ${position.market_price:.2f} — stop ${stop:.2f}"
            ))
        elif position.market_price <= stop * 1.02:
            alerts.append(Alert(
                level="WARNING",
                symbol=position.symbol,
                message=f"{position.symbol} within 2% of stop ${stop:.2f}. Current: ${position.market_price:.2f}"
            ))
    return alerts
```

- [ ] **Step 3: Run tests and verify they pass**

Run: `pytest tests/test_monitor.py`

- [ ] **Step 4: Commit**

```bash
git add agents/position_monitor.py tests/test_monitor.py
git commit -m "feat: implement position monitor logic"
```

---

### Task 5: Orchestration Flow (position_watch.py)

**Files:**
- Create: `flows/position_watch.py`
- Create: `logs/alerts_sent.db` (initialized via script)

- [ ] **Step 1: Implement the monitoring loop**

```python
import time
import json
import asyncio
import sqlite3
from data.fetchers.ibkr_fetcher import IBKRFetcher
from agents.position_monitor import check_stops
from alerts.telegram_bot import send_telegram_alert

def init_db():
    conn = sqlite3.connect('logs/alerts_sent.db')
    conn.execute('CREATE TABLE IF NOT EXISTS alerts_sent (id INTEGER PRIMARY KEY, sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, level TEXT, symbol TEXT, message TEXT)')
    conn.close()

async def run_monitor():
    init_db()
    fetcher = IBKRFetcher()
    with open('config/positions.json') as f:
        config = json.load(f)
    
    while True:
        try:
            snapshot = fetcher.get_portfolio_snapshot()
            alerts = check_stops(snapshot, config)
            for alert in alerts:
                await send_telegram_alert(alert)
                # Log to DB
                conn = sqlite3.connect('logs/alerts_sent.db')
                conn.execute('INSERT INTO alerts_sent (level, symbol, message) VALUES (?, ?, ?)', (alert.level, alert.symbol, alert.message))
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"Error in monitor loop: {e}")
        
        await asyncio.sleep(900) # 15 minutes

if __name__ == "__main__":
    asyncio.run(run_monitor())
```

- [ ] **Step 2: Commit**

```bash
git add flows/position_watch.py
git commit -m "feat: add position watch orchestration flow"
```
