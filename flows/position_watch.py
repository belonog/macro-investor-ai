import asyncio
import json
import logging
import sqlite3
import os
from datetime import datetime
from typing import Dict, Any

from agents.position_monitor import check_stops, Alert
from alerts.telegram_bot import send_telegram_alert
from data.fetchers.ibkr_fetcher import IBKRFetcher

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/position_watch.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("PositionWatch")

DB_PATH = "logs/alerts_sent.db"
CONFIG_PATH = "config/positions.json"

def init_db():
    """Initialize the SQLite database for tracking sent alerts."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts_sent (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            symbol TEXT,
            level TEXT,
            message TEXT,
            action TEXT
        )
    ''')
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")

def log_alert_to_db(alert: Alert):
    """Log a sent alert to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO alerts_sent (symbol, level, message, action)
        VALUES (?, ?, ?, ?)
    ''', (alert.symbol, alert.level, alert.message, alert.action))
    conn.commit()
    conn.close()

def load_config() -> Dict[str, Any]:
    """Load position configuration from JSON file."""
    if not os.path.exists(CONFIG_PATH):
        logger.error(f"Config file not found: {CONFIG_PATH}")
        return {}
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)

async def run_monitor():
    """Main monitoring loop."""
    init_db()
    
    fetcher = IBKRFetcher()
    
    while True:
        try:
            logger.info("Starting portfolio check...")
            
            # 1. Load latest config
            config = load_config()
            if not config:
                logger.warning("No configuration loaded. Skipping check.")
                await asyncio.sleep(60)
                continue

            # 2. Fetch portfolio snapshot
            async with fetcher:
                snapshot = await fetcher.get_portfolio_snapshot()
                
            if not snapshot:
                logger.warning("Failed to fetch portfolio snapshot or portfolio is empty.")
            else:
                # 3. Check for stops
                alerts = check_stops(snapshot, config)
                
                if alerts:
                    logger.info(f"Found {len(alerts)} alerts.")
                    for alert in alerts:
                        # 4. Send Telegram alerts
                        await send_telegram_alert(alert)
                        
                        # 5. Log alert to DB
                        log_alert_to_db(alert)
                else:
                    logger.info("No stop breaches detected.")

            logger.info("Check complete. Sleeping for 15 minutes...")
            await asyncio.sleep(900) # 15 minutes
            
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}", exc_info=True)
            logger.info("Retrying in 1 minute...")
            await asyncio.sleep(60)

if __name__ == "__main__":
    try:
        asyncio.run(run_monitor())
    except KeyboardInterrupt:
        logger.info("Monitor stopped by user.")
