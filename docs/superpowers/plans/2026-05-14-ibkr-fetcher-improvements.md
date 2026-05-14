# IBKR Fetcher Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve `IBKRFetcher` by updating the data model, enhancing connection logic with environment variables, and ensuring live price-based recalculations of portfolio values.

**Architecture:** Update `PositionSnapshot` Pydantic model to include PnL percentage and timestamps. Refactor `IBKRFetcher` to use `os.getenv` for configuration and update `get_portfolio_snapshot` to perform manual recalculations using fresh market data.

**Tech Stack:** Python, ib_insync, Pydantic, pytest.

---

### Task 1: Update PositionSnapshot Model

**Files:**
- Modify: `data/fetchers/ibkr_fetcher.py`

- [ ] **Step 1: Add imports and update model**

Add `datetime` and `timezone` from `datetime`. Update `PositionSnapshot` to include `unrealized_pnl_pct` and `fetched_at`.

```python
from datetime import datetime, timezone
# ... other imports

class PositionSnapshot(BaseModel):
    symbol: str
    quantity: float
    avg_cost: float
    market_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    fetched_at: datetime
```

- [ ] **Step 2: Commit**

```bash
git add data/fetchers/ibkr_fetcher.py
git commit -m "refactor: update PositionSnapshot model with PnL % and timestamp"
```

### Task 2: Improve Connection Logic

**Files:**
- Modify: `data/fetchers/ibkr_fetcher.py`

- [ ] **Step 1: Update IBKRFetcher.__init__ to use env vars**

Import `os` and use `os.getenv` to provide defaults for `host`, `port`, and `client_id`.

```python
import os
# ...

class IBKRFetcher:
    def __init__(self, host: Optional[str] = None, port: Optional[int] = None, client_id: Optional[int] = None):
        self.host = host or os.getenv('IBKR_HOST', '127.0.0.1')
        self.port = int(port or os.getenv('IBKR_PORT', 7497))
        self.client_id = int(client_id or os.getenv('IBKR_CLIENT_ID', 1))
        self.ib = IB()
```

- [ ] **Step 2: Commit**

```bash
git add data/fetchers/ibkr_fetcher.py
git commit -m "feat: use environment variables for IBKR connection settings"
```

### Task 3: Recalculate Portfolio Values

**Files:**
- Modify: `data/fetchers/ibkr_fetcher.py`

- [ ] **Step 1: Update get_portfolio_snapshot logic**

Update the loop in `get_portfolio_snapshot` to calculate `market_value`, `unrealized_pnl`, and `unrealized_pnl_pct` based on the fresh `market_price`.

```python
    async def get_portfolio_snapshot(self) -> List[PositionSnapshot]:
        # ... (keep connection check and fetching items/tickers)
        
        fetched_at = datetime.now(timezone.utc)
        snapshots = []
        for item in portfolio_items:
            ticker = ticker_map.get(item.contract.conId)
            market_price = ticker.marketPrice() if ticker and ticker.marketPrice() > 0 else item.marketPrice

            # Manual recalculations using fresh market price
            market_value = item.position * market_price
            unrealized_pnl = (market_price - item.averageCost) * item.position
            
            unrealized_pnl_pct = 0.0
            if item.averageCost != 0:
                unrealized_pnl_pct = ((market_price / item.averageCost) - 1) * 100

            snapshot = PositionSnapshot(
                symbol=item.contract.symbol,
                quantity=item.position,
                avg_cost=item.averageCost,
                market_price=market_price,
                market_value=market_value,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_pct=unrealized_pnl_pct,
                fetched_at=fetched_at
            )
            snapshots.append(snapshot)

        return snapshots
```

- [ ] **Step 2: Commit**

```bash
git add data/fetchers/ibkr_fetcher.py
git commit -m "feat: recalculate portfolio values based on fresh market price"
```

### Task 4: Update and Verify Tests

**Files:**
- Modify: `tests/test_ibkr_fetcher.py`

- [ ] **Step 1: Update tests to match new model and logic**

Update `test_get_portfolio_snapshot` and `test_get_portfolio_snapshot_fallback_price` to assert new fields and verify recalculations.

- [ ] **Step 2: Run tests**

Run: `pytest tests/test_ibkr_fetcher.py`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/test_ibkr_fetcher.py
git commit -m "test: update tests for IBKRFetcher improvements"
```
