import 'dotenv/config';
import { getLatestValues } from '../src/data/fetchers/fredFetcher.js';

async function main() {
  console.log('Fetching latest values (including derived metrics)...');
  try {
    const latest = await getLatestValues();
    console.log(JSON.stringify(latest, null, 2));
    console.log('\nTotal indicators:', Object.keys(latest).length);
  } catch (error) {
    console.error('Error fetching latest values:', error);
  }
}

main();
