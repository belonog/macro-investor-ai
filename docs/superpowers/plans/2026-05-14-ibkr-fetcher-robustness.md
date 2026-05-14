# IBKR Fetcher Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve IBKR fetcher reliability by implementing connection retries, better synchronization for portfolio data, and event loop health management.

**Architecture:** 
- Implement an exponential backoff retry mechanism in `connect()`.
- Add a waiting period and validation in `get_portfolio_snapshot` to ensure data is loaded after connection.
- Integrate `ib.sleep(0)` for event loop health.

**Tech Stack:** `ib_insync`, `asyncio`, `pytest-asyncio`

---

### Task 1: Implement Connection Retry Logic

**Files:**
- Modify: `data/fetchers/ibkr_fetcher.py`
- Test: `tests/test_ibkr_fetcher.py`

- [ ] **Step 1: Write failing test for retry logic**

Add to `tests/test_ibkr_fetcher.py`:
```python
@pytest.mark.asyncio
async def test_ibkr_fetcher_connect_retries(mock_ib):
    # Fail twice, succeed on third
    mock_ib.connectAsync.side_effect = [
        ConnectionError("Failed"),
        ConnectionError("Failed"),
        None
    ]
    mock_ib.isConnected.side_effect = [False, False, False, True]
    
    fetcher = IBKRFetcher(host='localhost', port=4001, client_id=10)
    # Mocking sleep to speed up test
    with patch('asyncio.sleep', new_callable=AsyncMock):
        await fetcher.connect()
    
    assert mock_ib.connectAsync.call_count == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ibkr_fetcher.py::test_ibkr_fetcher_connect_retries -v`

- [ ] **Step 3: Implement retry logic in `IBKRFetcher.connect`**

```python
import asyncio

# ... in IBKRFetcher ...
    async def connect(self, max_retries: int = 3, initial_delay: float = 1.0):
        """Connect to IBKR TWS/Gateway with retries."""
        for attempt in range(max_retries):
            try:
                if not self.ib.isConnected():
                    await self.ib.connectAsync(self.host, self.port, clientId=self.client_id)
                    logger.info(f"Connected to IBKR at {self.host}:{self.port}")
                    return
            except Exception as e:
                delay = initial_delay * (2 ** attempt)
                logger.error(f"Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {delay}s...")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(delay)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_ibkr_fetcher.py::test_ibkr_fetcher_connect_retries -v`

- [ ] **Step 5: Commit**

```bash
git add data/fetchers/ibkr_fetcher.py tests/test_ibkr_fetcher.py
git commit -m "feat: implement connection retry logic in IBKRFetcher"
```

### Task 2: Improve Portfolio Synchronization and Event Loop Health

**Files:**
- Modify: `data/fetchers/ibkr_fetcher.py`
- Test: `tests/test_ibkr_fetcher.py`

- [ ] **Step 1: Write failing test for portfolio synchronization**

```python
@pytest.mark.asyncio
async def test_get_portfolio_snapshot_waits_for_data(mock_ib):
    # Return empty list first, then populated list
    mock_ib.portfolio.side_effect = [[], [PortfolioItem(contract=Contract(symbol='AAPL'), position=10)]]
    mock_ib.isConnected.return_value = True
    mock_ib.reqTickersAsync.return_value = [MagicMock(spec=Ticker, marketPrice=lambda: 150.0)]
    
    fetcher = IBKRFetcher()
    with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
        snapshots = await fetcher.get_portfolio_snapshot()
        
    assert len(snapshots) == 1
    assert mock_sleep.call_count >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ibkr_fetcher.py::test_get_portfolio_snapshot_waits_for_data -v`

- [ ] **Step 3: Implement waiting and event loop health in `get_portfolio_snapshot`**

```python
    async def get_portfolio_snapshot(self) -> List[PositionSnapshot]:
        if not self.ib.isConnected():
            await self.connect()

        # Wait for portfolio data to populate
        for _ in range(5):
            portfolio_items = self.ib.portfolio()
            if portfolio_items:
                break
            logger.info("Waiting for portfolio items...")
            await self.ib.sleep(1) # ib.sleep(1) handles event loop and asyncio.sleep
        else:
            logger.warning("No portfolio items found after waiting.")
            return []
        
        # ... rest of the method ...
        # Add ib.sleep(0) periodically if processing large portfolios
        await self.ib.sleep(0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_ibkr_fetcher.py::test_get_portfolio_snapshot_waits_for_data -v`

- [ ] **Step 5: Commit**

```bash
git add data/fetchers/ibkr_fetcher.py
git commit -m "feat: improve portfolio synchronization and event loop health"
```
