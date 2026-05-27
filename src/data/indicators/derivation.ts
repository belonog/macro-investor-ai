import { MacroSnapshot, MacroIndicators, RawIndicator } from '../../types/index.js';
import { getManualIndicators } from '../../utils/manualIndicators.js';
import { logger } from '../../utils/logger.js';
import { INDICATORS } from './registry.js';

/**
 * Derives indicators from a raw macro snapshot for a given base date.
 * This function processes raw FRED series into semantic indicators.
 */
export function deriveMetrics(snapshot: MacroSnapshot, baseDate: string = new Date().toISOString()): MacroIndicators {
  const indicators: MacroIndicators = {};

  // Helpers
  const getSeriesLatestPoint = (id: string) => {
    const s = snapshot.series[id]?.filter(p => p.date <= baseDate);
    return s && s.length > 0 ? s[s.length - 1] : null;
  };

  const getSeriesValue = (id: string, offset: number = 0) => {
    const s = snapshot.series[id]?.filter(p => p.date <= baseDate);
    return s && s.length > offset ? s[s.length - 1 - offset].value : null;
  };

  const getSeriesValueMonthsAgo = (id: string, months: number) => {
    const s = snapshot.series[id]?.filter(p => p.date <= baseDate);
    if (!s || s.length === 0) return null;

    const lastPoint = s[s.length - 1];
    const lastDate = new Date(lastPoint.date);
    const targetDate = new Date(lastDate);
    targetDate.setMonth(targetDate.getMonth() - months);
    const targetStr = targetDate.toISOString().split('T')[0];

    for (let i = s.length - 1; i >= 0; i--) {
      if (s[i].date <= targetStr) return s[i].value;
    }
    return s[0].value;
  };

  const calculateYoY = (id: string) => {
    const curr = getSeriesValue(id, 0);
    const prior = getSeriesValueMonthsAgo(id, 12);
    if (curr !== null && prior !== null && prior !== 0) {
      return ((curr - prior) / prior) * 100;
    }
    return null;
  };

  const wrap = (key: string, value: number | null, overrideMetadata?: Partial<RawIndicator>): RawIndicator | null => {
    if (value === null) return null;

    const metadata = INDICATORS[key];
    if (!metadata) {
      logger.warn(`No indicator registry entry for key: ${key}`);
      return null;
    }

    let asOfSeriesId = metadata.rawSeriesId;
    if (!asOfSeriesId && metadata.dependsOn && metadata.dependsOn.length > 0) {
      asOfSeriesId = metadata.dependsOn[0];
    }

    const latestPoint = asOfSeriesId ? getSeriesLatestPoint(asOfSeriesId) : null;

    return {
      value,
      unit: overrideMetadata?.unit ?? metadata.unit,
      description: overrideMetadata?.description ?? metadata.description,
      source: overrideMetadata?.source ?? metadata.source,
      as_of: overrideMetadata?.as_of ?? latestPoint?.date ?? baseDate.split('T')[0],
    };
  };

  // 1. Calculations: Inflation Metrics
  const cpiYoY = calculateYoY('CPIAUCSL');
  if (cpiYoY !== null) {
    const w = wrap('cpi_yoy_pct', cpiYoY);
    if (w) indicators['cpi_yoy_pct'] = w;
  }

  const pceYoY = calculateYoY('PCEPI');
  if (pceYoY !== null) {
    const w = wrap('pce_yoy_pct', pceYoY);
    if (w) indicators['pce_yoy_pct'] = w;
  }

  const ppiYoY = calculateYoY('PPIACO');
  if (ppiYoY !== null) {
    const w = wrap('ppi_yoy_pct', ppiYoY);
    if (w) indicators['ppi_yoy_pct'] = w;
  }

  const oilCurr = getSeriesValue('DCOILWTICO', 0);
  const oil3mAgo = getSeriesValueMonthsAgo('DCOILWTICO', 3);
  if (oilCurr !== null && oil3mAgo !== null && oil3mAgo !== 0) {
    const val = ((oilCurr - oil3mAgo) / oil3mAgo) * 100;
    const w = wrap('oil_price_3m_change_pct', val);
    if (w) indicators['oil_price_3m_change_pct'] = w;
  }

  const coreCpiYoY = calculateYoY('CPILFESL');
  if (coreCpiYoY !== null) {
    const w = wrap('core_cpi_yoy_pct', coreCpiYoY);
    if (w) indicators['core_cpi_yoy_pct'] = w;
  }

  const corePceYoY = calculateYoY('PCEPILFE');
  if (corePceYoY !== null) {
    const w = wrap('core_pce_yoy_pct', corePceYoY);
    if (w) indicators['core_pce_yoy_pct'] = w;
  }

  const importPriceYoY = calculateYoY('IR');
  if (importPriceYoY !== null) {
    const w = wrap('import_price_yoy_pct', importPriceYoY);
    if (w) indicators['import_price_yoy_pct'] = w;
  }

  const aheYoY = calculateYoY('CES0500000003');
  if (aheYoY !== null) {
    const w = wrap('ahe_yoy_pct', aheYoY);
    if (w) indicators['ahe_yoy_pct'] = w;
  }

  // 2. Calculations: Growth Metrics
  const gdpCurr = getSeriesValue('GDPC1', 0);
  const gdpPrior = getSeriesValue('GDPC1', 1);
  if (gdpCurr !== null && gdpPrior !== null && gdpPrior !== 0) {
    const qoq = (gdpCurr - gdpPrior) / gdpPrior;
    const val = (Math.pow(1 + qoq, 4) - 1) * 100;
    const w = wrap('real_gdp_qoq_ann_pct', val);
    if (w) indicators['real_gdp_qoq_ann_pct'] = w;
  }

  const nfpSeries = snapshot.series['PAYEMS']?.filter(p => p.date <= baseDate);
  if (nfpSeries && nfpSeries.length >= 4) {
    const changes = [
      nfpSeries[nfpSeries.length - 1].value - nfpSeries[nfpSeries.length - 2].value,
      nfpSeries[nfpSeries.length - 2].value - nfpSeries[nfpSeries.length - 3].value,
      nfpSeries[nfpSeries.length - 3].value - nfpSeries[nfpSeries.length - 4].value,
    ];
    const val = changes.reduce((a, b) => a + b, 0) / 3;
    const w = wrap('nfp_3m_avg_k', val);
    if (w) indicators['nfp_3m_avg_k'] = w;
  }

  const rsNominalYoY = calculateYoY('RSAFS');
  if (rsNominalYoY !== null && cpiYoY !== null) {
    const val = rsNominalYoY - cpiYoY;
    const w = wrap('retail_sales_yoy_real_pct', val);
    if (w) indicators['retail_sales_yoy_real_pct'] = w;
  }

  const eciYoY = calculateYoY('ECIWAG');
  if (eciYoY !== null && cpiYoY !== null) {
    const val = eciYoY - cpiYoY;
    const w = wrap('real_wages_yoy_pct', val);
    if (w) indicators['real_wages_yoy_pct'] = w;
  }

  // 3. Derived Metrics: Spreads
  const y30 = getSeriesValue('DGS30');
  const y2 = getSeriesValue('DGS2');
  if (y30 !== null && y2 !== null) {
    const val = y30 - y2;
    const w = wrap('yield_curve_30_2', val);
    if (w) indicators['yield_curve_30_2'] = w;
  }

  const hySpread = getSeriesValue('BAMLH0A0HYM2');
  const s = snapshot.series['BAMLH0A0HYM2']?.filter(p => p.date <= baseDate);
  if (hySpread !== null && s && s.length >= 6) {
    const hyAvg6m = s.slice(-6).reduce((sum, p) => sum + p.value, 0) / 6;
    const val = hySpread - hyAvg6m;
    const w = wrap('credit_spread_delta', val);
    if (w) indicators['credit_spread_delta'] = w;
  }

  const y30Curr = getSeriesValue('DGS30', 0);
  const y30_3mAgo = getSeriesValueMonthsAgo('DGS30', 3);
  if (y30Curr !== null && y30_3mAgo !== null) {
    const w = wrap('yield_30y_3m_change_pct', y30Curr - y30_3mAgo);
    if (w) indicators['yield_30y_3m_change_pct'] = w;
  }

  const usdIndexCurr = getSeriesValue('DTWEXBGS', 0);
  const usd_index_3mAgo = getSeriesValueMonthsAgo('DTWEXBGS', 3);
  if (usdIndexCurr !== null && usd_index_3mAgo !== null && usd_index_3mAgo !== 0) {
    const w = wrap('usd_index_3m_change_pct', ((usdIndexCurr - usd_index_3mAgo) / usd_index_3mAgo) * 100);
    if (w) indicators['usd_index_3m_change_pct'] = w;
  }

  const goldCurr = getSeriesValue('C:XAUUSD', 0);
  const gold_3mAgo = getSeriesValueMonthsAgo('C:XAUUSD', 3);
  if (goldCurr !== null && gold_3mAgo !== null && gold_3mAgo !== 0) {
    const w = wrap('gold_3m_change_pct', ((goldCurr - gold_3mAgo) / gold_3mAgo) * 100);
    if (w) indicators['gold_3m_change_pct'] = w;
  }

  // 4. Map other raw series automatically
  for (const [key, def] of Object.entries(INDICATORS)) {
    if ((def.source === 'fred' || def.source === 'bls' || def.source === 'eia') && def.rawSeriesId) {
      const val = getSeriesValue(def.rawSeriesId, 0);
      if (val !== null) {
        const w = wrap(key, val);
        if (w) indicators[key] = w;
      }
    }
  }

  // 5. Merge manual indicators
  const manual = getManualIndicators();
  for (const [key, indicator] of Object.entries(manual)) {
    if (indicator.updated_at <= baseDate) {
      indicators[key] = {
        value: indicator.value,
        unit: INDICATORS[key]?.unit ?? 'manual',
        description: indicator.description ?? INDICATORS[key]?.description ?? key,
        source: INDICATORS[key]?.source ?? 'manual',
        as_of: indicator.period,
      };
    }
  }

  return indicators;
}
