import pytest
from unittest.mock import AsyncMock, patch
from alerts.telegram_bot import format_alert, send_telegram_alert
from agents.position_monitor import Alert
from telegram.error import NetworkError

def test_format_alert_critical():
    alert = Alert(
        level="CRITICAL", 
        symbol="TLT", 
        message="STOP BREACH: TLT at $87.50",
        action="Review exit — hard stop at $87.xx"
    )
    formatted = format_alert(alert)
    assert "🔴 CRITICAL — TLT" in formatted
    assert "STOP BREACH: TLT at $87.50" in formatted
    assert "Action: Review exit — hard stop at $87.xx" in formatted

def test_format_alert_warning_no_symbol():
    alert = Alert(level="WARNING", symbol=None, message="Generic warning message")
    formatted = format_alert(alert)
    assert "🟡 WARNING" in formatted
    assert "Generic warning message" in formatted

@pytest.mark.asyncio
@patch("alerts.telegram_bot.Bot")
@patch("os.getenv")
async def test_send_telegram_alert_success(mock_getenv, mock_bot_class):
    # Setup mocks
    mock_getenv.side_effect = lambda k: "test_token" if k == "TELEGRAM_BOT_TOKEN" else "test_chat_id"
    mock_bot_instance = mock_bot_class.return_value
    mock_bot_instance.send_message = AsyncMock()
    
    alert = Alert(level="INFO", symbol="AAPL", message="Price up")
    
    await send_telegram_alert(alert)
    
    mock_bot_instance.send_message.assert_called_once()
    args, kwargs = mock_bot_instance.send_message.call_args
    assert kwargs["chat_id"] == "test_chat_id"
    assert "🟢 INFO — AAPL" in kwargs["text"]

@pytest.mark.asyncio
@patch("alerts.telegram_bot.Bot")
@patch("os.getenv")
async def test_send_telegram_alert_retry_success(mock_getenv, mock_bot_class):
    mock_getenv.side_effect = lambda k: "test_token" if k == "TELEGRAM_BOT_TOKEN" else "test_chat_id"
    mock_bot_instance = mock_bot_class.return_value
    
    # Fail first, succeed second
    mock_bot_instance.send_message = AsyncMock(side_effect=[NetworkError("Retry me"), None])
    
    alert = Alert(level="INFO", symbol="AAPL", message="Price up")
    
    with patch("asyncio.sleep", AsyncMock()) as mock_sleep:
        await send_telegram_alert(alert, retries=2)
        assert mock_bot_instance.send_message.call_count == 2
        mock_sleep.assert_called_once()

@pytest.mark.asyncio
@patch("alerts.telegram_bot.Bot")
@patch("os.getenv")
async def test_send_telegram_alert_all_fails(mock_getenv, mock_bot_class):
    mock_getenv.side_effect = lambda k: "test_token" if k == "TELEGRAM_BOT_TOKEN" else "test_chat_id"
    mock_bot_instance = mock_bot_class.return_value
    
    mock_bot_instance.send_message = AsyncMock(side_effect=NetworkError("All fail"))
    
    alert = Alert(level="INFO", symbol="AAPL", message="Price up")
    
    with patch("asyncio.sleep", AsyncMock()):
        await send_telegram_alert(alert, retries=2)
        assert mock_bot_instance.send_message.call_count == 2
