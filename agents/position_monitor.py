from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict
from data.fetchers.ibkr_fetcher import PositionSnapshot

class Alert(BaseModel):
    level: str          # "INFO" | "WARNING" | "CRITICAL"
    symbol: str | None = None
    message: str
    action: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)

def check_stops(snapshot: List[PositionSnapshot], config: Dict[str, Dict[str, float]]) -> List[Alert]:
    """
    Check portfolio positions against stop-loss levels.
    
    CRITICAL: market_price <= stop
    WARNING: market_price <= stop * 1.02
    """
    alerts = []
    for pos in snapshot:
        symbol = pos.symbol
        if symbol in config:
            stop_level = config[symbol].get("stop")
            if stop_level is None:
                continue
                
            market_price = pos.market_price
            
            if market_price <= stop_level:
                alerts.append(Alert(
                    level="CRITICAL",
                    symbol=symbol,
                    message=f"STOP BREACH: {symbol} price {market_price} is at or below stop level {stop_level}",
                    action="EXIT"
                ))
            elif market_price <= stop_level * 1.02:
                alerts.append(Alert(
                    level="WARNING",
                    symbol=symbol,
                    message=f"STOP WARNING: {symbol} price {market_price} is within 2% of stop level {stop_level}",
                    action="MONITOR"
                ))
                
    return alerts
