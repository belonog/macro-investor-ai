import os
from telegram import Bot
from dotenv import load_dotenv
from agents.position_monitor import Alert

load_dotenv()

def format_alert(alert: Alert) -> str:
    emoji = {"INFO": "🟢", "WARNING": "🟡", "CRITICAL": "🔴"}.get(alert.level, "⚪")
    header = f"{emoji} {alert.level} — {alert.symbol}" if alert.symbol else f"{emoji} {alert.level}"
    return f"{header}\n━━━━━━━━━━━━━━━━━\n{alert.message}\n━━━━━━━━━━━━━━━━━"

async def send_telegram_alert(alert: Alert):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print(f"Telegram not configured. Alert: {alert.message}")
        return
    bot = Bot(token=token)
    await bot.send_message(chat_id=chat_id, text=format_alert(alert))
