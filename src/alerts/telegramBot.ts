import { Telegraf } from 'telegraf';
import { Alert, AlertLevel } from '../types/index.js';
import { dbManager } from '../agents/db.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = token ? new Telegraf(token) : null;

/**
 * Sends an alert message to a Telegram chat and logs it to the database.
 * @param alert The alert to send.
 */
export async function sendTelegramAlert(alert: Alert): Promise<void> {
  if (!bot || !chatId) {
    console.warn('Telegram bot not configured. Alert:', alert.message);
    // Even if bot is not configured, we might want to log it to DB
    dbManager.logAlert(alert);
    return;
  }

  const emoji = {
    'INFO': '🟢',
    'WARNING': '🟡',
    'CRITICAL': '🔴'
  }[alert.level as AlertLevel];

  const message = `${emoji} *${alert.level}* ${alert.symbol ? `— ${alert.symbol}` : ''}\n${alert.message}${alert.action ? `\n\n*Action:* ${alert.action}` : ''}`;

  const extra: any = { parse_mode: 'Markdown' };

  // Spec 6.9: Add basic inline keyboard support for CRITICAL alerts
  if (alert.level === 'CRITICAL') {
    extra.reply_markup = {
      inline_keyboard: [
        [
          { text: '✅ Acknowledge', callback_data: 'ack_alert' },
          { text: '🔄 Run Rebalancing', callback_data: 'run_rebalancing' }
        ]
      ]
    };
  }

  try {
    await bot.telegram.sendMessage(chatId, message, extra);
    // Log alert to DB
    dbManager.logAlert(alert);
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    // Still try to log to DB if sending failed
    dbManager.logAlert(alert);
  }
}
