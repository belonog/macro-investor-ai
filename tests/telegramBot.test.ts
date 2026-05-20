import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from '../src/config/env.js';

vi.mock('../src/config/env.js', () => ({
  env: {
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    NODE_ENV: 'test',
    LOG_LEVEL: 'info'
  }
}));

// Mock telegraf
const mockSendMessage = vi.fn().mockResolvedValue({ message_id: 123 });
vi.mock('telegraf', () => {
  return {
    Telegraf: vi.fn().mockImplementation(function() {
      return {
        telegram: {
          sendMessage: mockSendMessage
        }
      };
    })
  };
});

// Mock database functions
vi.mock('../src/db/database.js', () => {
  return {
    logAlert: vi.fn()
  };
});

describe('telegramBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should log alert even if bot is not configured', async () => {
    env.TELEGRAM_BOT_TOKEN = '';
    env.TELEGRAM_CHAT_ID = '';
    
    const { sendTelegramAlert } = await import('../src/alerts/telegramBot.js');
    const { logAlert } = await import('../src/db/database.js');

    await sendTelegramAlert({
      level: 'INFO',
      message: 'Test message',
      symbol: null,
      action: null,
      created_at: new Date().toISOString()
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(logAlert).toHaveBeenCalledWith(expect.objectContaining({
      level: 'INFO',
      message: 'Test message'
    }));
  });

  it('should call sendMessage when bot is configured', async () => {
    env.TELEGRAM_BOT_TOKEN = 'test_token';
    env.TELEGRAM_CHAT_ID = 'test_chat_id';

    const { sendTelegramAlert } = await import('../src/alerts/telegramBot.js');
    const { logAlert } = await import('../src/db/database.js');

    await sendTelegramAlert({
      level: 'CRITICAL',
      symbol: 'BTC',
      message: 'Crash imminent',
      action: 'Sell all',
      created_at: new Date().toISOString()
    });

    expect(mockSendMessage).toHaveBeenCalled();
    expect(logAlert).toHaveBeenCalledWith(expect.objectContaining({
      level: 'CRITICAL',
      symbol: 'BTC',
      message: 'Crash imminent',
      action: 'Sell all'
    }));
  });
});
