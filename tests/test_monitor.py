from agents.position_monitor import check_stops, Alert
from data.fetchers.ibkr_fetcher import PositionSnapshot
from datetime import datetime

def test_check_stops_breach():
    snapshot = [PositionSnapshot(
        symbol="TLT", quantity=100, avg_cost=90, 
        market_price=87, market_value=8700, 
        unrealized_pnl=-300, unrealized_pnl_pct=-3.33,
        fetched_at=datetime.now()
    )]
    config = {"TLT": {"stop": 88}}
    alerts = check_stops(snapshot, config)
    assert len(alerts) == 1
    assert alerts[0].level == "CRITICAL"
    assert "STOP BREACH" in alerts[0].message
    assert alerts[0].symbol == "TLT"

def test_check_stops_warning():
    # Warning level is market_price <= stop * 1.02
    # stop = 80, warning threshold = 81.6
    snapshot = [PositionSnapshot(
        symbol="AAPL", quantity=10, avg_cost=150, 
        market_price=81, market_value=810, 
        unrealized_pnl=-690, unrealized_pnl_pct=-46.0,
        fetched_at=datetime.now()
    )]
    config = {"AAPL": {"stop": 80}}
    alerts = check_stops(snapshot, config)
    assert len(alerts) == 1
    assert alerts[0].level == "WARNING"
    assert "STOP WARNING" in alerts[0].message

def test_check_stops_no_breach():
    snapshot = [PositionSnapshot(
        symbol="MSFT", quantity=10, avg_cost=300, 
        market_price=310, market_value=3100, 
        unrealized_pnl=100, unrealized_pnl_pct=3.33,
        fetched_at=datetime.now()
    )]
    config = {"MSFT": {"stop": 250}}
    alerts = check_stops(snapshot, config)
    assert len(alerts) == 0

def test_check_stops_missing_config():
    snapshot = [PositionSnapshot(
        symbol="GOOGL", quantity=10, avg_cost=100, 
        market_price=90, market_value=900, 
        unrealized_pnl=-100, unrealized_pnl_pct=-10.0,
        fetched_at=datetime.now()
    )]
    config = {} # Empty config
    alerts = check_stops(snapshot, config)
    assert len(alerts) == 0

def test_check_stops_missing_stop_key():
    snapshot = [PositionSnapshot(
        symbol="AMZN", quantity=10, avg_cost=100, 
        market_price=90, market_value=900, 
        unrealized_pnl=-100, unrealized_pnl_pct=-10.0,
        fetched_at=datetime.now()
    )]
    config = {"AMZN": {"target": 150}} # Missing "stop"
    alerts = check_stops(snapshot, config)
    assert len(alerts) == 0
