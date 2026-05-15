# Phase 6 & 7 Orchestration & CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the centralized orchestration flows, unified CLI, and scheduled operations for the Macro Investor AI system as defined in Spec v3.

**Architecture:** A set of functional flows in `src/flows/` that coordinate fetchers and agents, a `commander` CLI in `src/cli.ts` for on-demand execution, and a `node-cron` scheduler in `src/scheduler.ts` for automated runs.

**Tech Stack:** TypeScript, node-cron, commander, telegraf, axios, better-sqlite3.

---

### Task 1: Implement Telegram Alert Utility

**Files:**
- Create: `src/alerts/telegramBot.ts`

- [ ] **Step 1: Implement Telegram bot wrapper**

```typescript
import { Telegraf } from 'telegraf';
import { Alert, AlertLevel } from '../types/index.js';
import { dbManager } from '../agents/db.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const bot = token ? new Telegraf(token) : null;

export async function sendTelegramAlert(alert: Alert): Promise<void> {
  if (!bot || !chatId) {
    console.warn('Telegram bot not configured. Alert:', alert.message);
    return;
  }

  const emoji = {
    'INFO': '🟢',
    'WARNING': '🟡',
    'CRITICAL': '🔴'
  }[alert.level];

  const message = `${emoji} *${alert.level}* ${alert.symbol ? `— ${alert.symbol}` : ''}\n${alert.message}${alert.action ? `\n\n*Action:* ${alert.action}` : ''}`;

  try {
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    // Log alert to DB
    dbManager.logAlert({
      level: alert.level,
      symbol: alert.symbol || null,
      message: alert.message,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}
```

- [ ] **Step 2: Add logAlert to dbManager**

Modify: `src/agents/db.ts` to include `logAlert`.

---

### Task 2: Implement Missing Fetchers (BLS, EIA, Polygon)

**Files:**
- Create: `src/data/fetchers/blsFetcher.ts`
- Create: `src/data/fetchers/eiaFetcher.ts`
- Create: `src/data/fetchers/polygonFetcher.ts`

- [ ] **Step 1: Implement blsFetcher.ts** (Metadata/Recent releases stub)

- [ ] **Step 2: Implement eiaFetcher.ts** (Energy data stub or simple fetch)

- [ ] **Step 3: Implement polygonFetcher.ts** (Prices and Earnings)

---

### Task 3: Implement Flow 1: Regime Cycle

**Files:**
- Create: `src/flows/regimeCycle.ts`

- [ ] **Step 1: Implement regimeCycle logic**

```typescript
import { updateMacroCache, getLatestValues } from '../data/fetchers/fredFetcher.js';
import { evaluateRegime } from '../agents/regimeAgent.js';
import { generateRebalancingReport } from '../agents/rebalancingAgent.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';

export async function runRegimeCycle() {
  console.log('Starting Regime Cycle...');
  
  // 1. Update Macro Data
  const macroSnapshot = await updateMacroCache();
  const flatSnapshot = await getLatestValues();
  
  // 2. Run Regime Agent
  const assessment = await evaluateRegime(flatSnapshot);
  
  // 3. Conditional Rebalancing
  if (['Transitioning', 'Shifted'].includes(assessment.regime_drift_vs_prior)) {
    const report = await generateRebalancingReport();
    await sendTelegramAlert({
      level: assessment.regime_drift_vs_prior === 'Shifted' ? 'CRITICAL' : 'WARNING',
      message: `Regime ${assessment.regime_drift_vs_prior}: ${assessment.regime_quadrant}\nAlignment: ${report.alignment_grade} (${(report.regime_portfolio_alignment_score * 100).toFixed(0)}%)`,
      action: 'Review Rebalancing Report'
    });
  } else {
    await sendTelegramAlert({
      level: 'INFO',
      message: `Regime Stable: ${assessment.regime_quadrant} (Confidence: ${assessment.confidence}%)`,
    });
  }
}
```

---

### Task 4: Implement Flow 2: EOD Check

**Files:**
- Create: `src/flows/eodCheck.ts`

- [ ] **Step 1: Implement eodCheck logic**

```typescript
import { fetchPortfolioSnapshot } from '../data/fetchers/ibkrFetcher.js';
import { syncPositions } from '../utils/positionsSync.js';
import { getLatestValues } from '../data/fetchers/fredFetcher.js';
import { checkStopProximity, checkThesisThresholds, checkDeadlines } from '../monitor/eodMonitor.js';
import { sendTelegramAlert } from '../alerts/telegramBot.js';
import fs from 'fs';
import path from 'path';
import { PortfolioConfigSchema } from '../types/index.js';

const POSITIONS_CONFIG_PATH = path.join(process.cwd(), 'config', 'positions.json');

export async function runEodCheck() {
  console.log('Starting EOD Check...');
  
  const token = process.env.IBKR_FLEX_TOKEN!;
  const queryId = process.env.IBKR_FLEX_REPORT_ID!;
  
  // 1. Fetch Portfolio
  const snapshot = await fetchPortfolioSnapshot(token, queryId);
  
  // 2. Sync Positions
  const positionsConfig = JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8'));
  const { updatedConfig, alerts } = syncPositions(snapshot, positionsConfig);
  fs.writeFileSync(POSITIONS_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
  
  for (const alert of alerts) {
    await sendTelegramAlert(alert);
  }
  
  // 3. Monitor
  const indicators = await getLatestValues();
  const typedConfig = PortfolioConfigSchema.parse(updatedConfig);
  
  const stopAlerts = checkStopProximity({}, typedConfig); // Add EOD prices if available
  const thesisAlerts = checkThesisThresholds(indicators, typedConfig);
  const deadlineAlerts = checkDeadlines(typedConfig);
  
  for (const alert of [...stopAlerts, ...thesisAlerts, ...deadlineAlerts]) {
    await sendTelegramAlert(alert);
  }
}
```

---

### Task 5: Implement Unified CLI

**Files:**
- Create: `src/cli.ts`

- [ ] **Step 1: Setup commander CLI**

```typescript
import { Command } from 'commander';
import { runRegimeCycle } from './flows/regimeCycle.js';
import { runEodCheck } from './flows/eodCheck.js';
import { generateRebalancingReport } from './agents/rebalancingAgent.js';
// ... import other agents

const program = new Command();

program
  .name('macro-investor')
  .description('Macro Investor AI CLI')
  .version('1.0.0');

program.command('regime')
  .description('Run full regime cycle')
  .action(runRegimeCycle);

program.command('eod')
  .description('Run EOD portfolio check')
  .action(runEodCheck);

program.command('rebalance')
  .description('Generate rebalancing report')
  .action(async () => {
    const report = await generateRebalancingReport();
    console.log(JSON.stringify(report, null, 2));
  });

// Add add-position, set-indicator etc.

program.parse();
```

---

### Task 6: Implement Scheduler

**Files:**
- Create: `src/scheduler.ts`

- [ ] **Step 1: Setup node-cron schedules**

```typescript
import cron from 'node-cron';
import { runRegimeCycle } from './flows/regimeCycle.js';
import { runEodCheck } from './flows/eodCheck.js';

// Sunday 9 AM ET
cron.schedule('0 9 * * 0', async () => {
  console.log('Running Scheduled Regime Cycle');
  await runRegimeCycle();
}, { timezone: 'America/New_York' });

// Weekdays 4:15 PM ET
cron.schedule('15 16 * * 1-5', async () => {
  console.log('Running Scheduled EOD Check');
  await runEodCheck();
}, { timezone: 'America/New_York' });

console.log('Scheduler started.');
```

---

### Task 7: Final Verification

- [ ] **Step 1: Test CLI commands**
- [ ] **Step 2: Test flows with mocked data**
- [ ] **Step 3: Verify Telegram alerts work**
