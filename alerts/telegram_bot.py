import os
import logging
import asyncio
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError
from dotenv import load_dotenv
from agents.position_monitor import Alert

load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/telegram_bot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("TelegramBot")

def format_alert(alert: Alert) -> str:
    emoji = {"INFO": "🟢", "WARNING": "🟡", "CRITICAL": "🔴"}.get(alert.level, "⚪")
    header = f"{emoji} {alert.level} — {alert.symbol}" if alert.symbol else f"{emoji} {alert.level}"
    msg = [
        header,
        "━━━━━━━━━━━━━━━━━",
        alert.message
    ]
    if alert.action:
        msg.append(f"Action: {alert.action}")
    msg.append("━━━━━━━━━━━━━━━━━")
    return "\n".join(msg)

async def send_telegram_alert(alert: Alert, retries: int = 3):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        logger.warning(f"Telegram not configured. Alert: {alert.message}")
        return

    bot = Bot(token=token)
    text = format_alert(alert)
    
    reply_markup = None
    if alert.level == "CRITICAL":
        keyboard = [
            [
                InlineKeyboardButton("Acknowledge", callback_data=f"ack_{alert.symbol}"),
                InlineKeyboardButton("Run Review", callback_data=f"review_{alert.symbol}")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

    for attempt in range(retries):
        try:
            await bot.send_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup
            )
            logger.info(f"Alert sent to Telegram: {alert.level} - {alert.symbol}")
            return
        except TelegramError as e:
            logger.error(f"Attempt {attempt + 1} failed to send Telegram alert: {e}")
            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt) # Exponential backoff
            else:
                # Fallback log
                logger.critical(f"FALLBACK: Failed to send alert after {retries} attempts. Alert content: {text}")
