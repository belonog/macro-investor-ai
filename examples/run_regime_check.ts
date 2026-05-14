import dotenv from 'dotenv';
import { updateMacroCache, getLatestValues } from '../src/data/fetchers/fredFetcher.js';
import { evaluateRegime } from '../src/agents/regimeAgent.js';

dotenv.config();

async function main() {
  console.log('🚀 Initializing Phase 1: Macro Regime Check');
  
  try {
    // 1. Fetch latest data from FRED
    console.log('\n📡 Step 1: Updating Macro Data from FRED...');
    const snapshot = await updateMacroCache(12); // Fetch 12 months of history
    const seriesCount = Object.keys(snapshot).length;
    console.log(`✅ Successfully updated ${seriesCount} series in cache.`);

    // 2. Get latest values for the agent
    console.log('\n📊 Step 2: Extracting Latest Indicators...');
    const latestValues = await getLatestValues();
    console.log('Current Indicators:', JSON.stringify(latestValues, null, 2));

    // 3. Evaluate Regime via Gemini
    console.log('\n🧠 Step 3: Evaluating Macro Regime via Gemini 2.0 Flash...');
    const regime = await evaluateRegime(latestValues);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`CURRENT REGIME: ${regime.quadrant}`);
    console.log(`CONFIDENCE:     ${regime.confidence}%`);
    console.log(`EVALUATED AT:   ${regime.evaluatedAt}`);
    console.log('\nKEY DRIVERS:');
    regime.keyDrivers.forEach(driver => console.log(`• ${driver}`));
    
    if (regime.transitionSignal) {
      console.log(`\n⚠️ TRANSITION SIGNAL: ${regime.transitionSignal}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n✅ Logged to SQLite (logs/regime_history.db)');
    
  } catch (error) {
    console.error('\n❌ Error during execution:');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.message.includes('API_KEY')) {
        console.log('\n💡 Tip: Ensure GEMINI_API_KEY and FRED_API_KEY are set in your .env file.');
      }
    } else {
      console.error(error);
    }
  }
}

main();
