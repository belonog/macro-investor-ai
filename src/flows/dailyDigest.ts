import fs from 'fs';
import path from 'path';
import { runRegimeCycle } from './regimeCycle.js';
import { getEarningsCalendar } from '../data/fetchers/polygonFetcher.js';
import { getLatestValues } from '../data/fetchers/fredFetcher.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import { RegimeAssessment, PortfolioConfigSchema } from '../types/index.js';

const REGIME_CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regime_latest.json');
const POSITIONS_CONFIG_PATH = path.join(process.cwd(), 'config', 'positions.json');

/**
 * Morning digest flow: checks regime staleness, upcoming earnings, and key indicators.
 */
export async function runDailyDigest() {
  try {
    console.log('Starting Daily Digest...');

    // 1. Read regime_latest.json — check assessed_at
    if (!fs.existsSync(REGIME_CACHE_PATH)) {
      console.log('No regime assessment found. Running regime cycle...');
      await runRegimeCycle('scheduled');
    }

    let regimeAssessment: RegimeAssessment;
    try {
      regimeAssessment = JSON.parse(fs.readFileSync(REGIME_CACHE_PATH, 'utf8'));
    } catch {
      console.error('Failed to parse regime assessment. Running regime cycle...');
      await runRegimeCycle('scheduled');
      regimeAssessment = JSON.parse(fs.readFileSync(REGIME_CACHE_PATH, 'utf8'));
    }

    const assessed_at_raw = regimeAssessment.assessed_at;
    const assessedAt = new Date(assessed_at_raw);
    const now = new Date();
    const diffDays = (now.getTime() - assessedAt.getTime()) / (1000 * 3600 * 24);

    if (diffDays > 7) {
      console.log(`Regime assessment is stale (${diffDays.toFixed(1)} days). Running regime cycle...`);
      await runRegimeCycle('scheduled');
      regimeAssessment = JSON.parse(fs.readFileSync(REGIME_CACHE_PATH, 'utf8'));
    }

    // 2. Get Earnings Calendar for held symbols
    let heldSymbols: string[] = [];
    if (fs.existsSync(POSITIONS_CONFIG_PATH)) {
      try {
        const positionsConfig = PortfolioConfigSchema.parse(JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8')));
        heldSymbols = Object.keys(positionsConfig);
      } catch (err) {
        console.warn('Failed to parse positions.json for daily digest:', err);
      }
    }
    
    const earnings = heldSymbols.length > 0 ? await getEarningsCalendar(heldSymbols, 1) : [];

    // 3. Get latest macro values
    const latestValues = await getLatestValues();

    // 4. Format and send Telegram digest
    let message = `🗞 *Daily Macro Digest*\n\n`;
    message += `*Current Regime:* ${regimeAssessment.regime_quadrant}\n`;
    message += `*Confidence:* ${regimeAssessment.final_confidence}%\n`;
    message += `*Last Assessed:* ${new Date(assessed_at_raw).toLocaleDateString()}\n\n`;

    message += `*Key Indicators:*\n`;
    const y30 = latestValues['DGS30'];
    const be5y = latestValues['T5YIE'];
    const nfp = latestValues['nfp_3m_avg_k'];

    if (y30 !== undefined) message += `- 30Y Yield: ${y30.value.toFixed(2)}%\n`;
    if (be5y !== undefined) message += `- 5Y Breakeven: ${be5y.value.toFixed(2)}%\n`;
    if (nfp !== undefined) message += `- NFP (3m Avg): ${nfp.value.toFixed(0)}k\n`;
    message += `\n`;

    if (earnings.length > 0) {
      message += `*Upcoming Earnings (24h):*\n`;
      for (const e of earnings) {
        message += `- ${e.symbol}: ${e.report_date} (${e.time_of_day})\n`;
      }
      message += `\n`;
    } else {
      message += `*Earnings:* None scheduled for held symbols.\n\n`;
    }

    await sendTelegramAlert({
      level: 'INFO',
      message: message,
      created_at: new Date().toISOString(),
      symbol: null,
      action: null
    });

    console.log('Daily Digest Completed.');
  } catch (error) {
    console.error('Daily Digest Failed:', error);
    throw error;
  }
}
