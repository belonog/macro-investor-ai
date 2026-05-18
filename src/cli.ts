#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { runRegimeCycle } from './flows/regimeCycle.js';
import { runEodCheck } from './flows/eodCheck.js';
import { runEventPrebrief } from './flows/eventPrebrief.js';
import { generateRebalancingReport } from './agents/rebalancingAgent.js';
import { setManualIndicator } from './utils/manualIndicators.js';
import { runCoherenceAgent } from './agents/coherenceAgent.js';
import { runInterpreterAgent } from './agents/interpreterAgent.js';
import { db } from './db/database.js';
import { PortfolioConfigSchema, PositionType } from './types/index.js';

const program = new Command();

program
  .name('macro-investor-ai')
  .description('Unified CLI for Macro Investor AI')
  .version('1.0.0');

program
  .command('regime')
  .description('Run full regime cycle (fetch macro, evaluate regime, rebalance if needed)')
  .option('-t, --trigger <trigger>', 'Trigger for the cycle (manual, post_release, scheduled)', 'manual')
  .action(async (options) => {
    try {
      await runRegimeCycle(options.trigger);
      console.log('Regime cycle completed.');
    } catch (error) {
      console.error('Regime cycle failed:', error);
      process.exit(1);
    }
  });

program
  .command('eod')
  .description('Run EOD check (fetch portfolio, sync positions, monitor stops/thesis)')
  .action(async () => {
    try {
      await runEodCheck();
      console.log('EOD check completed.');
    } catch (error) {
      console.error('EOD check failed:', error);
      process.exit(1);
    }
  });

program
  .command('prebrief')
  .description('Run event pre-brief flow (check upcoming earnings and generate briefs)')
  .action(async () => {
    try {
      await runEventPrebrief();
      console.log('Event pre-brief completed.');
    } catch (error) {
      console.error('Event pre-brief failed:', error);
      process.exit(1);
    }
  });

program
  .command('rebalance')
  .description('Generate and log rebalancing report')
  .action(async () => {
    try {
      const report = await generateRebalancingReport();
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('Rebalancing report failed:', error);
      process.exit(1);
    }
  });

program
  .command('coherence')
  .description('Run coherence check for a proposed trade')
  .argument('<symbol>', 'Ticker symbol')
  .argument('<thesis>', 'Investment thesis')
  .option('-s, --size <number>', 'Proposed size in USD', '0')
  .action(async (symbol, thesis, options) => {
    try {
      const positionsPath = path.join(process.cwd(), 'config', 'positions.json');
      const positionsConfig = JSON.parse(fs.readFileSync(positionsPath, 'utf8'));
      const currentRegime = db.getLatestRegime();
      
      if (!currentRegime) {
        console.error('No regime assessment found in database. Run "regime" first.');
        process.exit(1);
      }

      const output = await runCoherenceAgent({
        symbol,
        thesis,
        proposedSizeUsd: parseFloat(options.size),
        currentBook: positionsConfig,
        currentRegime: currentRegime
      });
      console.log(JSON.stringify(output, null, 2));
    } catch (error) {
      console.error('Coherence check failed:', error);
      process.exit(1);
    }
  });

program
  .command('interpret')
  .description('Interpret raw economic data release')
  .argument('<name>', 'Release name (e.g., CPI, NFP)')
  .argument('<data>', 'Raw data or path to file containing data')
  .action(async (name, data) => {
    try {
      let releaseData = data;
      if (fs.existsSync(data)) {
        releaseData = fs.readFileSync(data, 'utf8');
      }

      const positionsPath = path.join(process.cwd(), 'config', 'positions.json');
      const positionsConfig = JSON.parse(fs.readFileSync(positionsPath, 'utf8'));

      const output = await runInterpreterAgent(name, releaseData, positionsConfig);
      console.log(JSON.stringify(output, null, 2));
    } catch (error) {
      console.error('Interpretation failed:', error);
      process.exit(1);
    }
  });

program
  .command('add-position')
  .description('Add or update a position in the configuration')
  .option('--symbol <symbol>', 'Ticker symbol')
  .option('--shares <number>', 'Number of shares', '0')
  .option('--avg-cost <number>', 'Average cost per share', '0')
  .option('--type <type>', 'Position type (macro_core, macro_hedge, speculative, equity_single)', 'macro_core')
  .option('--thesis <thesis>', 'Investment thesis', '')
  .option('--invalidation <invalidation>', 'Thesis invalidation criteria', '')
  .action(async (options) => {
    try {
      if (!options.symbol) {
        console.error('Error: --symbol is required');
        process.exit(1);
      }

      const positionsPath = path.join(process.cwd(), 'config', 'positions.json');
      let positionsConfig: any = {};
      if (fs.existsSync(positionsPath)) {
        positionsConfig = JSON.parse(fs.readFileSync(positionsPath, 'utf8'));
      }
      
      positionsConfig[options.symbol.toUpperCase()] = {
        shares: parseFloat(options.shares),
        avg_cost: parseFloat(options.avgCost),
        position_type: options.type as PositionType,
        thesis: options.thesis,
        regime_match: [], // To be filled manually or by agent later
        thesis_invalidation: options.invalidation
      };

      // Validate against schema
      PortfolioConfigSchema.parse(positionsConfig);

      fs.writeFileSync(positionsPath, JSON.stringify(positionsConfig, null, 2));
      console.log(`Position for ${options.symbol.toUpperCase()} added/updated in ${positionsPath}`);
    } catch (error) {
      console.error('Failed to add position:', error);
      process.exit(1);
    }
  });

program
  .command('set-indicator')
  .description('Set a manual indicator value')
  .argument('<key>', 'Indicator key (e.g., "nfp_forecast")')
  .argument('<value>', 'Numeric value')
  .option('-p, --period <YYYY-MM>', 'Period for the indicator', new Date().toISOString().slice(0, 7))
  .option('-s, --source <string>', 'Source of the data', 'manual')
  .action((key, value, options) => {
    const val = parseFloat(value);
    if (isNaN(val)) {
      console.error('Value must be a number');
      process.exit(1);
    }
    
    setManualIndicator(key, {
      value: val,
      period: options.period,
      updatedAt: new Date().toISOString(),
      source: options.source,
    });
    
    console.log(`Manual indicator ${key} set to ${val} for period ${options.period}.`);
  });

program.parse();
