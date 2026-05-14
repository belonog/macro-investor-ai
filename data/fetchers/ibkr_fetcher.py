import logging
import os
from datetime import datetime, timezone
from typing import List, Optional
from ib_insync import IB, Contract, PortfolioItem, Ticker
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class PositionSnapshot(BaseModel):
    symbol: str
    quantity: float
    avg_cost: float
    market_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    fetched_at: datetime

class IBKRFetcher:
    def __init__(self, host: Optional[str] = None, port: Optional[int] = None, client_id: Optional[int] = None):
        self.host = host or os.getenv('IBKR_HOST', '127.0.0.1')
        self.port = int(port or os.getenv('IBKR_PORT', 7497))
        self.client_id = int(client_id or os.getenv('IBKR_CLIENT_ID', 1))
        self.ib = IB()

    async def connect(self):
        """Connect to IBKR TWS/Gateway."""
        try:
            if not self.ib.isConnected():
                await self.ib.connectAsync(self.host, self.port, clientId=self.client_id)
                logger.info(f"Connected to IBKR at {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Failed to connect to IBKR: {e}")
            raise

    def disconnect(self):
        """Disconnect from IBKR."""
        if self.ib.isConnected():
            self.ib.disconnect()
            logger.info("Disconnected from IBKR")

    async def get_portfolio_snapshot(self) -> List[PositionSnapshot]:
        """
        Fetch current portfolio positions and their live market prices.
        """
        if not self.ib.isConnected():
            await self.connect()

        portfolio_items: List[PortfolioItem] = self.ib.portfolio()
        if not portfolio_items:
            logger.warning("No portfolio items found.")
            return []

        # Request tickers for all contracts to get the most recent market prices
        contracts = [item.contract for item in portfolio_items]
        tickers: List[Ticker] = await self.ib.reqTickersAsync(*contracts)
        
        # Create a mapping for quick lookup
        ticker_map = {ticker.contract.conId: ticker for ticker in tickers}

        fetched_at = datetime.now(timezone.utc)
        snapshots = []
        for item in portfolio_items:
            # Use ticker market price if available, otherwise fallback to portfolio item market price
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

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
