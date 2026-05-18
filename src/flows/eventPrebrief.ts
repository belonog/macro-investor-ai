import fs from 'fs';
import path from 'path';
import { getEarningsCalendar } from '../data/fetchers/polygonFetcher.js';
import { generatePrebrief } from '../agents/interpreterAgent.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import { PortfolioConfigSchema } from '../types/index.js';

const POSITIONS_CONFIG_PATH = path.join(process.cwd(), 'config', 'positions.json');

/**
 * Event Pre-Brief flow: checks for upcoming earnings events and generates AI pre-briefs.
 */
export async function runEventPrebrief() {
  try {
    console.log('Starting Event Pre-Brief flow...');

    // 1. Load Positions Config
    if (!fs.existsSync(POSITIONS_CONFIG_PATH)) {
      console.warn('Positions config not found. Skipping event pre-brief.');
      return;
    }

    const positionsConfig = PortfolioConfigSchema.parse(
      JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8'))
    );
    const heldSymbols = Object.keys(positionsConfig);

    if (heldSymbols.length === 0) {
      console.log('No held symbols found. Skipping event pre-brief.');
      return;
    }

    // 2. Fetch Earnings Calendar (2 days ahead)
    const events = await getEarningsCalendar(heldSymbols, 2);

    if (events.length === 0) {
      console.log('No upcoming earnings events found within 48h.');
      return;
    }

    console.log(`Found ${events.length} upcoming events. Generating pre-briefs...`);

    // 3. Generate Pre-Briefs for each event
    for (const event of events) {
      const symbol = event.symbol;
      const thesis = positionsConfig[symbol]?.thesis || 'No thesis provided.';
      
      console.log(`Generating pre-brief for ${symbol}...`);
      const prebrief = await generatePrebrief(symbol, thesis, event, positionsConfig);

      // 4. Send to Telegram
      await sendTelegramAlert({
        level: 'WARNING',
        symbol: symbol,
        message: `🔔 *Pre-Brief: ${symbol} Earnings*\n\n${prebrief.summary_markdown}`,
        action: 'Review Thesis',
        createdAt: new Date().toISOString()
      });
    }

    console.log('Event Pre-Brief flow completed.');
  } catch (error) {
    console.error('Event Pre-Brief flow failed:', error);
    throw error;
  }
}
