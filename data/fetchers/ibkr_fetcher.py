import logging
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

class IBKRFetcher:
    def __init__(self, host: str = '127.0.0.1', port: int = 7497, client_id: int = 1):
        self.host = host
        self.port = port
        self.client_id = client_id
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

        snapshots = []
        for item in portfolio_items:
            # Use ticker market price if available, otherwise fallback to portfolio item market price
            ticker = ticker_map.get(item.contract.conId)
            market_price = ticker.marketPrice() if ticker and ticker.marketPrice() > 0 else item.marketPrice

            snapshot = PositionSnapshot(
                symbol=item.contract.symbol,
                quantity=item.position,
                avg_cost=item.averageCost,
                market_price=market_price,
                market_value=item.marketValue,
                unrealized_pnl=item.unrealizedPNL
            )
            snapshots.append(snapshot)

        return snapshots

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
