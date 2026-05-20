import './config/env.js';
import cron from 'node-cron';
import { runRegimeCycle }   from './flows/regimeCycle.js';
import { runDailyDigest }   from './flows/dailyDigest.js';
import { runEodCheck }      from './flows/eodCheck.js';
import { runEventPrebrief } from './flows/eventPrebrief.js';
import { logger } from './utils/logger.js';

// Sunday 9 AM ET
cron.schedule('0 9 * * 0', async () => {
  logger.info('Running Scheduled Regime Cycle');
  try {
    await runRegimeCycle('scheduled');
  } catch (error) {
    logger.error(error, 'Scheduled Regime Cycle Failed');
  }
}, { timezone: 'America/New_York' });

// Weekday mornings 7 AM ET
cron.schedule('0 7 * * 1-5', async () => {
  logger.info('Running Scheduled Daily Digest');
  try {
    await runDailyDigest();
  } catch (error) {
    logger.error(error, 'Scheduled Daily Digest Failed');
  }
}, { timezone: 'America/New_York' });

// Weekdays 4:15 PM ET (16:15)
cron.schedule('15 16 * * 1-5', async () => {
  logger.info('Running Scheduled EOD Check');
  try {
    await runEodCheck();
  } catch (error) {
    logger.error(error, 'Scheduled EOD Check Failed');
  }
}, { timezone: 'America/New_York' });

// Weekday evenings 6 PM ET (18:00)
cron.schedule('0 18 * * 0-4', async () => {
  logger.info('Running Scheduled Event Prebrief');
  try {
    await runEventPrebrief();
  } catch (error) {
    logger.error(error, 'Scheduled Event Prebrief Failed');
  }
}, { timezone: 'America/New_York' });

logger.info('Scheduler started.');
