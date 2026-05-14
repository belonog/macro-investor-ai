import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { generateRebalancingReport } from '../src/agents/rebalancingAgent.js';
import { runEodMonitor } from '../src/monitor/eodMonitor.js';

dotenv.config();

async function main() {
  console.log('🧐 MACRO INVESTOR AI — SYSTEM STATUS REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // 1. Check Regime
    const REGIME_PATH = path.join(process.cwd(), 'src', 'data', 'cache', 'regimeLatest.json');
    if (fs.existsSync(REGIME_PATH)) {
      const regime = JSON.parse(fs.readFileSync(REGIME_PATH, 'utf8'));
      console.log(`\n🌍 CURRENT REGIME: ${regime.quadrant} (${regime.confidence}%)`);
      console.log(`📈 DRIFT:          ${regime.regime_drift_vs_prior}`);
      console.log(`📅 ASSESSED:       ${regime.evaluatedAt}`);
    } else {
      console.log('\n⚠️ No regime assessment found. Run run_regime_check.ts first.');
    }

    // 2. Run Rebalancing Agent
    console.log('\n🤖 Running Rebalancing Agent (AI)...');
    const report = await generateRebalancingReport();
    console.log(`✅ ALIGNMENT:      ${report.alignment_grade} (${(report.alignment_score * 100).toFixed(1)}%)`);
    
    console.log('\n📢 PRIORITY ACTIONS:');
    report.priority_actions.forEach((a, i) => console.log(`${i + 1}. ${a}`));

    // 3. Run EOD Risk Monitor
    console.log('\n🛡️ Running EOD Risk Monitor...');
    const alerts = await runEodMonitor();
    if (alerts.length === 0) {
      console.log('✅ No risk alerts. Portfolio is within thresholds.');
    } else {
      alerts.forEach(alert => {
        const icon = alert.level === 'CRITICAL' ? '🔴' : '🟡';
        console.log(`${icon} [${alert.level}] ${alert.symbol || 'SYSTEM'}: ${alert.message}`);
        if (alert.action) console.log(`   👉 Suggested Action: ${alert.action}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 Report Complete.');

  } catch (error) {
    console.error('\n❌ Execution Error:');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  }
}

main();
