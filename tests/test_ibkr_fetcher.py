import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from ib_insync import Contract, PortfolioItem, Ticker
from data.fetchers.ibkr_fetcher import IBKRFetcher, PositionSnapshot

@pytest.fixture
def mock_ib():
    with patch('data.fetchers.ibkr_fetcher.IB') as MockIB:
        mock_instance = MockIB.return_value
        mock_instance.isConnected.return_value = False
        mock_instance.connectAsync = AsyncMock()
        mock_instance.disconnect = MagicMock()
        mock_instance.portfolio = MagicMock()
        mock_instance.reqTickersAsync = AsyncMock()
        yield mock_instance

@pytest.mark.asyncio
async def test_ibkr_fetcher_connect(mock_ib):
    fetcher = IBKRFetcher(host='localhost', port=4001, client_id=10)
    await fetcher.connect()
    
    mock_ib.connectAsync.assert_called_once_with('localhost', 4001, clientId=10)

@pytest.mark.asyncio
async def test_get_portfolio_snapshot(mock_ib):
    # Setup mock data
    contract = Contract(symbol='AAPL', conId=123)
    portfolio_item = PortfolioItem(
        contract=contract,
        position=10.0,
        marketPrice=150.0,
        marketValue=1500.0,
        averageCost=140.0,
        unrealizedPNL=100.0,
        realizedPNL=0.0,
        account='DU123'
    )
    mock_ib.portfolio.return_value = [portfolio_item]
    
    mock_ticker = MagicMock(spec=Ticker)
    mock_ticker.contract = contract
    mock_ticker.marketPrice.return_value = 155.0
    mock_ib.reqTickersAsync.return_value = [mock_ticker]
    mock_ib.isConnected.return_value = True

    fetcher = IBKRFetcher()
    snapshots = await fetcher.get_portfolio_snapshot()

    assert len(snapshots) == 1
    snapshot = snapshots[0]
    assert snapshot.symbol == 'AAPL'
    assert snapshot.quantity == 10.0
    assert snapshot.market_price == 155.0
    assert snapshot.avg_cost == 140.0
    assert snapshot.unrealized_pnl == 100.0

@pytest.mark.asyncio
async def test_get_portfolio_snapshot_fallback_price(mock_ib):
    # Setup mock data where ticker price is not available
    contract = Contract(symbol='AAPL', conId=123)
    portfolio_item = PortfolioItem(
        contract=contract,
        position=10.0,
        marketPrice=150.0,
        marketValue=1500.0,
        averageCost=140.0,
        unrealizedPNL=100.0,
        realizedPNL=0.0,
        account='DU123'
    )
    mock_ib.portfolio.return_value = [portfolio_item]
    
    mock_ticker = MagicMock(spec=Ticker)
    mock_ticker.contract = contract
    mock_ticker.marketPrice.return_value = float('nan') # or 0.0
    mock_ib.reqTickersAsync.return_value = [mock_ticker]
    mock_ib.isConnected.return_value = True

    fetcher = IBKRFetcher()
    snapshots = await fetcher.get_portfolio_snapshot()

    assert len(snapshots) == 1
    snapshot = snapshots[0]
    assert snapshot.market_price == 150.0 # Should fallback to portfolio price
