# IBKR Fetcher Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize `IBKRFetcher` by ensuring portfolio data synchronization after connection and improving async citizenship.

**Architecture:** 
- Add a synchronization loop in `connect()` that waits for `self.ib.portfolio()` to populate.
- Add `await self.ib.sleep(0)` in `get_portfolio_snapshot` to yield control back to the event loop.

**Tech Stack:** `ib_insync`, `asyncio`

---

### Task 1: Add Portfolio Synchronization to `connect`

**Files:**
- Modify: `data/fetchers/ibkr_fetcher.py`
- Test: `tests/test_ibkr_fetcher.py`

- [ ] **Step 1: Write the failing test for synchronization timeout**
Update `tests/test_ibkr_fetcher.py` to verify that `connect` waits for portfolio data if requested.

```python
@pytest.mark.asyncio
async def test_ibkr_fetcher_connect_sync_wait(mock_ib):
    mock_ib.isConnected.side_effect = [False, True, True, True]
    # Simulate empty portfolio initially, then populated
    mock_ib.portfolio.side_effect = [[], [], [MagicMock(spec=PortfolioItem)]]
    
    fetcher = IBKRFetcher()
    with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
        await fetcher.connect(sync_portfolio=True, sync_timeout=5)
        
    assert mock_ib.portfolio.call_count == 3
    assert mock_sleep.call_count >= 2
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest tests/test_ibkr_fetcher.py::test_ibkr_fetcher_connect_sync_wait -v`
Expected: FAIL (sync_portfolio argument not supported)

- [ ] **Step 3: Implement synchronization logic in `connect`**
Modify `connect` in `data/fetchers/ibkr_fetcher.py`.

```python
    async def connect(self, max_retries: int = 3, initial_delay: float = 1.0, sync_portfolio: bool = False, sync_timeout: float = 10.0):
        """Connect to IBKR TWS/Gateway with retries."""
        for attempt in range(max_retries):
            try:
                if not self.ib.isConnected():
                    await self.ib.connectAsync(self.host, self.port, clientId=self.client_id)
                    logger.info(f"Connected to IBKR at {self.host}:{self.port}")
                
                if self.ib.isConnected():
                    if sync_portfolio:
                        logger.info("Synchronizing portfolio data...")
                        start_time = asyncio.get_event_loop().time()
                        while not self.ib.portfolio() and (asyncio.get_event_loop().time() - start_time) < sync_timeout:
                            await asyncio.sleep(0.1)
                        if not self.ib.portfolio():
                            logger.warning("Portfolio synchronization timed out or portfolio is empty.")
                        else:
                            logger.info("Portfolio synchronized.")
                    return
            except Exception as e:
                delay = initial_delay * (2 ** attempt)
                logger.error(f"Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {delay}s...")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(delay)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest tests/test_ibkr_fetcher.py::test_ibkr_fetcher_connect_sync_wait -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add data/fetchers/ibkr_fetcher.py tests/test_ibkr_fetcher.py
git commit -m "feat: add portfolio synchronization to IBKRFetcher.connect"
```

---

### Task 2: Improve Event Loop Health

**Files:**
- Modify: `data/fetchers/ibkr_fetcher.py`

- [ ] **Step 1: Add `await self.ib.sleep(0)` in `get_portfolio_snapshot`**
Ensure the async loop stays responsive.

```python
    async def get_portfolio_snapshot(self) -> List[PositionSnapshot]:
        """
        Fetch current portfolio positions and their live market prices.
        """
        if not self.ib.isConnected():
            await self.connect(sync_portfolio=True)

        portfolio_items: List[PortfolioItem] = self.ib.portfolio()
        await self.ib.sleep(0) # Yield to event loop
        if not portfolio_items:
            logger.warning("No portfolio items found.")
            return []
        
        # ... rest of the method
```

- [ ] **Step 2: Run all tests to ensure no regressions**
Run: `pytest tests/test_ibkr_fetcher.py -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**
```bash
git add data/fetchers/ibkr_fetcher.py
git commit -m "refactor: improve event loop health in get_portfolio_snapshot"
```
