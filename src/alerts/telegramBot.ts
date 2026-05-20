import { Telegraf } from 'telegraf';
import { Alert } from '../types/index.js';
import { logAlert } from '../db/database.js';
import { logger } from '../utils/logger.js';
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
    logger.warn({ alert }, 'Telegram bot not configured');
    // Even if bot is not configured, we might want to log it to DB
    logAlert(alert);
    return;
  }

  const emoji = {
    'INFO': '🟢',
    'WARNING': '🟡',
    'CRITICAL': '🔴'
  }[alert.level];

  const message = `${emoji} *${alert.level}* ${alert.symbol ? `— ${alert.symbol}` : ''}\n${alert.message}${alert.action ? `\n\n*Action:* ${alert.action}` : ''}`;

  const extra: { 
    parse_mode: 'Markdown', 
    reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] } 
  } = { parse_mode: 'Markdown' };

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
    logAlert(alert);
  } catch (error) {
    logger.error(error, 'Failed to send Telegram message');
    // Still try to log to DB if sending failed
    logAlert(alert);
  }
}
