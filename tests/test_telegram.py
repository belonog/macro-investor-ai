from alerts.telegram_bot import format_alert
from agents.position_monitor import Alert

def test_format_alert_critical():
    alert = Alert(level="CRITICAL", symbol="TLT", message="STOP BREACH: TLT at $87.50 — stop $88.00")
    formatted = format_alert(alert)
    assert "🔴 CRITICAL — TLT" in formatted
    assert "STOP BREACH: TLT at $87.50 — stop $88.00" in formatted

def test_format_alert_warning_no_symbol():
    alert = Alert(level="WARNING", symbol=None, message="Generic warning message")
    formatted = format_alert(alert)
    assert "🟡 WARNING" in formatted
    assert "Generic warning message" in formatted
