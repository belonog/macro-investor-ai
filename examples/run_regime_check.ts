import dotenv from 'dotenv';
import { updateMacroCache, getLatestValues } from '../src/data/fetchers/fredFetcher.js';
import { evaluateRegime } from '../src/agents/regimeAgent.js';

dotenv.config();

async function main() {
  console.log('🚀 Initializing Phase 1: Macro Regime Check');
  
  try {
    // 1. Fetch latest data from FRED
    console.log('\n📡 Step 1: Updating Macro Data from FRED...');
    const snapshot = await updateMacroCache(); 
    const seriesCount = Object.keys(snapshot.series).length;
    console.log(`✅ Successfully updated ${seriesCount} series in cache.`);

    // 2. Get latest values for the agent
    console.log('\n📊 Step 2: Extracting Latest Indicators...');
    const latestValues = await getLatestValues();
    console.log('Current Indicators:', JSON.stringify(latestValues, null, 2));

    // 3. Evaluate Regime via Gemini
    console.log('\n🧠 Step 3: Evaluating Macro Regime via Gemini...');
    const regime = await evaluateRegime(latestValues);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`CURRENT REGIME: ${regime.regime_quadrant}`);
    console.log(`CONFIDENCE:     ${regime.confidence}%`);
    console.log(`DRIFT:          ${regime.regime_drift_vs_prior}`);
    console.log(`INFLATION SCORE: ${(regime.inflation_score * 100).toFixed(1)}%`);
    console.log(`GROWTH SCORE:    ${(regime.growth_score * 100).toFixed(1)}%`);
    console.log(`EVALUATED AT:    ${regime.assessed_at}`);
    
    console.log('\nKEY DRIVERS:');
    regime.key_drivers.forEach(driver => console.log(`• ${driver}`));
    
    console.log('\nCENTRAL THESIS CONFLICT:');
    console.log(regime.central_thesis_conflict);

    console.log('\nFASTEST PATH TO BEING WRONG:');
    console.log(`⚠️ ${regime.fastest_path_to_being_wrong}`);

    if (regime.transition_signal) {
      console.log(`\n🚨 TRANSITION SIGNAL: ${regime.transition_signal}`);
    }

    console.log('\nWATCH NEXT:');
    regime.watch_next.forEach(event => console.log(`👀 ${event}`));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    
    console.log('\n✅ Logged to SQLite (logs/macro_investor.db)');
    
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
