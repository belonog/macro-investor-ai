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

  // 1. Calculate and map indicators
  for (const [key, def] of Object.entries(INDICATORS)) {
    if (def.source === 'calculated' && def.calculation) {
      let val: number | null = null;
      const calc = def.calculation;

      switch (calc.type) {
        case 'yoy':
          val = calculateYoY(calc.seriesId);
          break;
        case 'change_pct': {
          const curr = getSeriesValue(calc.seriesId, 0);
          const prior = getSeriesValueMonthsAgo(calc.seriesId, calc.months);
          if (curr !== null && prior !== null && prior !== 0) {
            val = ((curr - prior) / prior) * 100;
          }
          break;
        }
        case 'change_abs': {
          const curr = getSeriesValue(calc.seriesId, 0);
          const prior = getSeriesValueMonthsAgo(calc.seriesId, calc.months);
          if (curr !== null && prior !== null) {
            val = curr - prior;
          }
          break;
        }
        case 'qoq_ann_pct': {
          const curr = getSeriesValue(calc.seriesId, 0);
          const prior = getSeriesValue(calc.seriesId, 1);
          if (curr !== null && prior !== null && prior !== 0) {
            const qoq = (curr - prior) / prior;
            val = (Math.pow(1 + qoq, 4) - 1) * 100;
          }
          break;
        }
        case 'avg_change': {
          const s = snapshot.series[calc.seriesId]?.filter(p => p.date <= baseDate);
          if (s && s.length > calc.periods) {
            let sum = 0;
            for (let i = 0; i < calc.periods; i++) {
              sum += s[s.length - 1 - i].value - s[s.length - 2 - i].value;
            }
            val = sum / calc.periods;
          }
          break;
        }
        case 'real_yoy': {
          const nom = calculateYoY(calc.nominalSeriesId);
          const cpi = calculateYoY(calc.cpiSeriesId);
          if (nom !== null && cpi !== null) {
            val = nom - cpi;
          }
          break;
        }
        case 'spread': {
          const left = getSeriesValue(calc.leftSeriesId);
          const right = getSeriesValue(calc.rightSeriesId);
          if (left !== null && right !== null) {
            val = left - right;
          }
          break;
        }
        case 'spread_delta_avg': {
          const spread = getSeriesValue(calc.seriesId);
          const s = snapshot.series[calc.seriesId]?.filter(p => p.date <= baseDate);
          if (spread !== null && s && s.length >= calc.periods) {
            const avg = s.slice(-calc.periods).reduce((sum, p) => sum + p.value, 0) / calc.periods;
            val = spread - avg;
          }
          break;
        }
      }

      if (val !== null) {
        const w = wrap(key, val);
        if (w) indicators[key] = w;
      }
    } else if ((def.source === 'fred' || def.source === 'bls' || def.source === 'eia') && def.rawSeriesId) {
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
