# Prompt Engineering Review: Macro Regime + Portfolio Assessment System

> Reviewed by: Claude Sonnet 4.6  
> Date: 2026-05-29  
> Scope: Regime Engine prompt, Portfolio Action prompt, data schema, output schema

---

## Executive Summary

The system's conceptual architecture is sound — a two-stage pipeline where a regime classifier feeds a portfolio action engine is the right design. The core weaknesses fall into four categories:

1. **Regime Engine**: No smoothing/persistence, missing leading indicators, binary classification at ambiguous boundary, debasement risk is narratively identified but not structurally scored.
2. **Portfolio Prompt**: Confidence score from the regime engine is not used to gate action aggressiveness. Boundary Zone produces the same action types as a high-confidence quadrant.
3. **Data**: `portfolio_snapshot` is empty, so the prompt has no P&L context; options/derivatives are unmodeled entirely.
4. **Output Schema**: No aggregate exposure metrics, no position-sizing magnitude, no cross-position correlation signal.

The fixes below are ordered from highest to lowest impact.

---

## Part 1: Regime Engine Improvements

### 1.1 — Add Regime Persistence (Smoothing Layer)

**Current problem:** A single anomalous data point (e.g., one weak NFP print) can shift the classification. The example assessment itself flags this: jobless claims at 202.5k contradict the 48k NFP print — but the engine still moves the growth score sharply.

**Fix:** Add a **rolling regime state** input and an **exponential smoothing** instruction:

```
<regime_persistence>
You will receive the prior_regime_state (quadrant + scores from the last N assessments).
Apply exponential smoothing with alpha=0.35 to the raw scores before classification:
  smoothed_score = (alpha * current_raw_score) + ((1 - alpha) * prior_smoothed_score)
Classify on the SMOOTHED score, but report BOTH raw and smoothed values.
If raw and smoothed scores produce different quadrant classifications, this is a
"Transition Signal" — flag it explicitly and use the smoothed classification as the
operative one, unless 3+ confirming indicators all point to the raw quadrant.
</regime_persistence>
```

Add to the input schema:
```json
"prior_regime_state": {
  "assessments": [
    { "date": "2026-05-15", "quadrant": "Stagflation", "inflation_score": 0.69, "growth_score": 0.48 },
    { "date": "2026-05-08", "quadrant": "Stagflation", "inflation_score": 0.67, "growth_score": 0.51 }
  ]
}
```

### 1.2 — Probabilistic Regime Output (Replace Binary Classification)

**Current problem:** The engine returns one quadrant. At boundary conditions (growth score 0.491, confidence 68%), this false precision leads the portfolio prompt to treat it like a definitive signal.

**Fix:** Replace the single `regime_quadrant` field with a **probability distribution** across all quadrants:

```json
"regime_probabilities": {
  "Goldilocks": 0.05,
  "Inflationary Boom": 0.18,
  "Stagflation": 0.52,
  "Deflationary Recession": 0.25
},
"operative_regime": "Stagflation",
"operative_confidence": 52,
"secondary_regime": "Deflationary Recession",
"secondary_weight": 0.25
```

The portfolio prompt then uses `secondary_regime` and `secondary_weight` to model the "what if we're wrong" scenario explicitly, rather than burying it in a narrative field.

### 1.3 — Add Missing Leading Indicators

The current indicator set is heavily **coincident** (CPI, PCE, GDP, payrolls). A regime classifier should lead the market, not confirm what's already priced. Add:

| Indicator | Source | Why |
|-----------|--------|-----|
| **2s10s Yield Curve Spread** | FRED T10Y2Y | Best single predictor of recession onset, 6-18 month lead |
| **3m10y Yield Curve Spread** | FRED T10Y3M | Better short-run recession signal than 2s10s |
| **HY Credit Spread (OAS)** | FRED BAMLH0A0HYM2 | Risk-off signal; widens before growth rolls |
| **Conference Board LEI** | Calculated | Purpose-built leading composite |
| **ISM New Orders sub-index** | Manual | Leads ISM headline by 1-2 months |
| **Real M2 Growth YoY** | FRED M2SL + CPI | Monetary contraction precedes disinflation by 12-18 months |
| **University of Michigan 1Y Inflation Expectations** | FRED MICH | Feeds into Fed reaction function |
| **NFIB Small Business Uncertainty** | NFIB | High sensitivity to tariff/policy environment |

Add these as a new `leading_indicators` block in the schema, weighted separately from lagging/coincident indicators. The overall growth and inflation scores should then be composites of leading (weight: 40%), coincident (40%), and lagging (20%) sub-scores — which also gives you a built-in warning system when leading and coincident diverge.

### 1.4 — Model Dollar Debasement as an Explicit 5th Dimension

**Current problem:** `petrodollar_risk` is a narrative field ("Active Risk"), which the portfolio prompt can't act on structurally. The current assessment correctly identifies the debasement signal (gold at $4,533, 30Y yield at 5.11%, DXY at 119 — though 119 seems high for DXY in a debasement scenario, verify this), but it sits in a prose field that gets ignored by the action logic.

**Fix:** Add a scored `debasement_overlay` as a separate dimension alongside inflation and growth:

```json
"debasement_overlay": {
  "score": 0.0-1.0,
  "signal": "None | Emerging | Active | Acute",
  "indicators": {
    "gold_real_rate_divergence": "Gold rising despite real yields rising — classic debasement",
    "dxy_trend_vs_yield": "Yields rising without USD strengthening = foreign demand loss",
    "treasury_auction_bid_cover": "Below 2.3x = supply concern",
    "foreign_reserve_usd_share": "Trending down = de-dollarization"
  }
}
```

This allows the portfolio prompt to include a `debasement_overlay` branch in its action logic: when this score is high, nominal Treasuries (TLT/VGLT) get a **structural headwind** flag regardless of the growth quadrant, because the debasement scenario is the one case where yields rise AND growth falls simultaneously — the exact catastrophic conflict the current assessment describes.

### 1.5 — Improve the Boundary Zone Handling

**Current problem:** The engine flags "Boundary Zone" but provides no structured playbook. The portfolio prompt then receives an ambiguous regime and applies the same action logic as a clean quadrant.

**Fix:** Add explicit Boundary Zone semantics to the regime engine prompt:

```
<boundary_zone_protocol>
A Boundary Zone exists when any primary score falls within ±0.08 of the 0.5 threshold
(growth) or ±0.06 of the 0.6 threshold (inflation).

When in Boundary Zone:
1. Report the two most probable adjacent quadrants and their weights.
2. Identify which SINGLE indicator, if revised, would resolve the ambiguity (the
   "pivot indicator") — this becomes the highest-priority data watch.
3. Emit a "split_regime_playbook": one set of implications for each adjacent quadrant.
   The portfolio prompt will use this to model both scenarios simultaneously.
4. Set requires_human_review = true unconditionally.
</boundary_zone_protocol>
```

Add to output:
```json
"boundary_zone_detail": {
  "adjacent_quadrants": ["Stagflation", "Inflationary Boom"],
  "adjacent_weights": [0.62, 0.38],
  "pivot_indicator": "NFP (next release will resolve growth ambiguity)",
  "split_regime_playbook": {
    "if_Stagflation_confirmed": "Increase real asset hedges, reduce nominal bond exposure",
    "if_Inflationary_Boom_confirmed": "Reduce defensive positions, add cyclical equity exposure"
  }
}
```

---

## Part 2: Portfolio Action Prompt Improvements

### 2.1 — Confidence-Gated Action Rules (Highest Impact Fix)

**Current problem:** At 68% confidence with a Boundary Zone classification, the portfolio prompt still allows "Exit" recommendations on macro_core positions. This is the single most dangerous failure mode in a fully automated pipeline.

**Fix:** Add an explicit confidence gate section to the system prompt:

```
<confidence_gate>
The regime assessment includes a final_confidence score (0-100).

Apply the following action ceiling rules unconditionally:

| Confidence | Max allowed action on macro_core | Max allowed action on macro_hedge |
|------------|----------------------------------|-----------------------------------|
| < 60%      | Watch                            | Watch                             |
| 60-69%     | Watch (flag for human review)    | Trim (if thesis invalidation threshold is breached) |
| 70-79%     | Hold or Trim                     | Trim or Exit                      |
| 80%+       | Full action set available        | Full action set available         |

Exception: A hard_exit_at threshold breach (e.g., 30Y yield > 5.10%) bypasses
the confidence gate and always triggers Exit, regardless of confidence score.
This is a pre-committed rule, not a discretionary one.
</confidence_gate>
```

### 2.2 — Handle Empty `portfolio_snapshot` Gracefully

When `portfolio_snapshot` is empty, the system currently has no P&L context. Add explicit fallback logic:

```
<snapshot_fallback>
If portfolio_snapshot is empty or null, operate in "config-only mode":
- Use avg_cost from positions_config as the reference price.
- You cannot calculate unrealized P&L or proximity to stops in dollar terms.
- Flag every position assessment with "snapshot_missing: true".
- Do not suggest position-size changes (Add/Trim) that require knowing
  current market value — use "Watch" instead, with the note that sizing
  decisions require a live snapshot.
- The priority_actions list must include "Connect portfolio snapshot feed" as
  action #1 if snapshot is empty.
</snapshot_fallback>
```

Once the `PositionSnapshot` feed is live, the prompt should use `unrealized_pnl_pct` to:
- Flag positions near their stops (e.g., within 5% of hard stop) as Immediate urgency
- Distinguish "trim for risk management" from "trim for profit-taking" in the rationale
- Calculate dollar-value concentration (not just share count)

### 2.3 — Add Aggregate Portfolio Analytics to Output

The current output assesses each position individually but gives no portfolio-level view. Add a `portfolio_analytics` block:

```json
"portfolio_analytics": {
  "regime_exposure_pct": {
    "Stagflation": 0.52,
    "Deflationary Recession": 0.28,
    "All_regimes": 0.12,
    "Misaligned": 0.08
  },
  "thesis_conflict_pairs": [
    {
      "long": "TLT",
      "short_or_conflicting": "SM",
      "conflict": "SM requires sustained oil inflation; TLT requires oil/inflation collapse",
      "net_exposure": "Partially offsetting — resolve by staging exits"
    }
  ],
  "concentration_flags": [
    "Energy/commodity cluster (XLE + SM + ILF + DBA) = ~35% of book — single-factor risk"
  ],
  "liquidity_buffer_pct": 0.10
}
```

This is the field that most transforms the output from "list of position opinions" to "portfolio-level decision support."

### 2.4 — Add Position Sizing Magnitude to Suggested Actions

**Current problem:** "Trim" tells you direction but not size. In a fully automated pipeline that sends a Telegram report, "Trim XLE" without magnitude is not actionable.

**Fix:** Add `action_magnitude` to each position assessment:

```json
{
  "symbol": "XLE",
  "suggested_action": "Trim",
  "action_magnitude": {
    "direction": "reduce",
    "target_pct_of_current": 0.5,
    "rationale": "Reduce by ~50% to size position to debasement overlay risk budget, retain core stagflation exposure"
  }
}
```

The magnitude rules should be specified in the system prompt:
```
<sizing_rules>
Trim: Reduce position by 25-50% unless stop is immediately threatened (then 50-75%).
Exit: Close 100% unless thesis_invalidation is partial — then 75%, flagged for human review.
Add: Increase by 25% initially; second Add to 50% increase requires a subsequent assessment.
Never recommend increasing a position that is within 10% of its hard stop.
</sizing_rules>
```

### 2.5 — Add Options/Derivatives Position Type

You hold options positions (TLT bull call spread, Dec 31 $92/$103C) that the current schema has no vocabulary for. Add:

```json
"TLT_CALLS": {
  "description": "TLT Dec 31 $92/$103 Bull Call Spread",
  "position_type": "options_derivative",
  "underlying": "TLT",
  "structure": "bull_call_spread",
  "long_strike": 92,
  "short_strike": 103,
  "expiry": "2026-12-31",
  "contracts": 1,
  "max_profit_capped": true,
  "thesis": "Same as TLT — recession forces Fed to cut, long end rallies to sub-4.50% yield",
  "thesis_invalidation": "30Y yield holds above 5.10% through Q3 2026 with no recession signal",
  "time_decay_flag": "Expiry in 7 months — thesis must materialize by Q4 2026 for max value"
}
```

The portfolio prompt should include specific options assessment rules:
```
<options_assessment_rules>
For options_derivative positions:
1. Assess time_decay_flag: if expiry is within 90 days and thesis shows no progress, urgency = Immediate.
2. For capped-upside structures (bull call spread): assess whether removing the cap (rolling to naked long) 
   is justified if regime probability of the target quadrant exceeds 60%.
3. Never suggest "Hold" on an options position without flagging remaining time value and theta decay rate.
</options_assessment_rules>
```

### 2.6 — Restructure the Thesis Conflict Resolution Field

The current `thesis_conflict_resolution` is a single narrative string. In a complex book with multiple conflicts, this gets unwieldy. Replace with a structured array:

```json
"thesis_conflicts": [
  {
    "conflict_id": "TLT_vs_SM",
    "positions": ["TLT", "VGLT", "SM"],
    "conflict_type": "regime_incompatibility",
    "description": "SM requires oil inflation; TLT/VGLT require oil/inflation collapse",
    "resolution_path": "Sequential: SM funds TLT entry size after partial trim; SM exits when recession signal triggers",
    "trigger_for_resolution": "NFP 2-print below 100k OR 30Y yield breaks below 4.50%",
    "current_status": "Unresolved — both positions active simultaneously"
  },
  {
    "conflict_id": "TLT_vs_debasement",
    "positions": ["TLT", "VGLT"],
    "conflict_type": "macro_overlay_conflict",
    "description": "Nominal Treasuries lose safe-haven function under dollar debasement / fiscal dominance",
    "resolution_path": "Hedge with GLD; consider TIPS (SCHP) as partial replacement for nominal duration",
    "trigger_for_resolution": "Debasement overlay score falls below 0.4",
    "current_status": "Active — debasement overlay score 0.7+"
  }
]
```

---

## Part 3: Updated Data Schema

### 3.1 — Full Input Schema (Annotated)

```typescript
type RegimeEngineInput = {
  // Core indicator data (existing — keep)
  normalized_inflation_indicators: IndicatorData[];
  normalized_growth_indicators: IndicatorData[];
  
  // NEW: Leading indicator sub-block
  leading_indicators: {
    yield_curve_2s10s: number;        // FRED T10Y2Y
    yield_curve_3m10y: number;        // FRED T10Y3M  
    hy_credit_spread_oas: number;     // FRED BAMLH0A0HYM2
    conference_board_lei_mom: number; // MoM % change
    ism_new_orders: number;           // ISM Manufacturing sub-index
    real_m2_yoy: number;              // M2 deflated by CPI
    umich_1y_inflation_exp: number;   // FRED MICH
    nfib_uncertainty_index: number;   // NFIB survey
  };

  // NEW: Debasement overlay inputs
  debasement_inputs: {
    gold_price: number;
    real_yield_10y: number;           // FRED DFII10
    dxy_index: number;                // DXY
    treasury_30y_yield: number;
    foreign_reserve_usd_share_yoy_delta: number; // IMF COFER data (quarterly)
    recent_auction_bid_cover: number; // Most recent 30Y auction
  };

  // NEW: Regime history for smoothing
  prior_regime_state: {
    assessments: Array<{
      date: string;
      quadrant: string;
      inflation_score: number;
      growth_score: number;
      smoothed_inflation: number;
      smoothed_growth: number;
    }>;
  };
};

type PortfolioActionInput = {
  regime_assessment: RegimeEngineOutput;     // Full output from regime engine
  portfolio_snapshot: PositionSnapshot[];    // Live from IBKR (may be empty)
  positions_config: Record<string, PositionConfig>;
  options_positions: OptionsPositionConfig[];  // NEW — separate from equity
  
  // NEW: User context (injected at automation time)
  assessment_context: {
    days_since_last_assessment: number;
    last_priority_actions_taken: string[];    // Track which actions were executed
    manual_overrides: string[];               // Human flags from Telegram interaction
  };
};
```

### 3.2 — Enhanced `PositionConfig` Schema

Add the fields that the portfolio prompt needs but currently infers:

```typescript
type PositionConfig = {
  // Existing fields (keep)
  description: string;
  shares: number;
  avg_cost: number;
  position_type: "macro_core" | "macro_hedge" | "speculative" | "equity_single" | "options_derivative" | "cash_equivalent";
  thesis: string;
  regime_match: string[];
  thesis_invalidation: string;
  
  // NEW: Structured stop hierarchy
  stop_hierarchy: {
    hard_stop?: number;              // Price level — unconditional exit
    thesis_stop?: string;            // Condition-based exit (text)
    yield_threshold?: {              // For rate-sensitive positions
      warn_at: number;
      hard_exit_at: number;
    };
    time_stop?: string;              // For speculative / thesis-expiry positions
  };

  // NEW: Correlation cluster tag
  correlation_cluster: "rates" | "energy_commodity" | "precious_metals" | "em_equity" | "defensive_equity" | "volatility" | "cash";
  
  // NEW: Sizing intent
  target_pct_of_portfolio: number;   // Intended weight
  max_pct_of_portfolio: number;      // Hard cap
};
```

---

## Part 4: Revised Output Schema

### 4.1 — Regime Engine Output (Additions in bold)

```json
{
  "inflation_score_raw": 0.721,
  "inflation_score_smoothed": 0.704,
  "growth_score_raw": 0.491,
  "growth_score_smoothed": 0.511,
  "regime_probabilities": {
    "Goldilocks": 0.04,
    "Inflationary Boom": 0.15,
    "Stagflation": 0.54,
    "Deflationary Recession": 0.27
  },
  "operative_regime": "Stagflation",
  "secondary_regime": "Deflationary Recession",
  "secondary_weight": 0.27,
  "final_confidence": 70,
  "debasement_overlay": {
    "score": 0.74,
    "signal": "Active",
    "primary_drivers": ["Gold-real-rate divergence", "Weak 30Y auction demand"]
  },
  "boundary_zone_detail": { ... },
  "transition_signal": "...",
  "watch_next": [ ... ]
}
```

### 4.2 — Portfolio Action Output (Full Revised Schema)

```json
{
  "snapshot_mode": "config_only | live",
  "alignment_score": 0.0,
  "alignment_grade": "A | B | C | D",
  
  "portfolio_analytics": {
    "regime_exposure_pct": {
      "Stagflation": 0.52,
      "Deflationary Recession": 0.28,
      "All_regimes": 0.12,
      "Misaligned": 0.08
    },
    "correlation_cluster_exposure": {
      "energy_commodity": 0.35,
      "rates": 0.28,
      "precious_metals": 0.06,
      "cash": 0.10,
      "defensive_equity": 0.06,
      "em_equity": 0.05
    },
    "debasement_overlay_exposure": {
      "protected": 0.18,
      "exposed": 0.28,
      "neutral": 0.54
    },
    "liquidity_buffer_pct": 0.10,
    "concentration_flags": ["string"]
  },

  "position_assessments": [
    {
      "symbol": "string",
      "position_type": "string",
      "regime_fit": "Strong | Moderate | Weak | Misaligned",
      "debasement_fit": "Positive | Neutral | Negative",
      "thesis_intact": true,
      "snapshot_missing": false,
      "suggested_action": "Hold | Add | Trim | Exit | Watch",
      "action_magnitude": {
        "direction": "reduce | increase | close | none",
        "target_pct_of_current": 0.5,
        "rationale": "string"
      },
      "action_rationale": "string",
      "urgency": "None | This Week | Immediate",
      "confidence_gate_applied": false,
      "stop_proximity_pct": null,
      "conflict_flag": "string"
    }
  ],

  "thesis_conflicts": [
    {
      "conflict_id": "string",
      "positions": ["string"],
      "conflict_type": "regime_incompatibility | macro_overlay_conflict | timing_mismatch",
      "resolution_path": "string",
      "trigger_for_resolution": "string",
      "current_status": "Unresolved | Monitoring | Resolving"
    }
  ],

  "priority_actions": ["string"],
  "regime_transition_implication": "string",
  "rebalancing_rationale": "string",
  "fastest_path_to_being_wrong": "string"
}
```

---

## Part 5: Prompt Structural Improvements

### 5.1 — Add a Chain-of-Thought Forcing Structure to the Portfolio Prompt

The current `<reasoning>` block instruction is good but underspecified. The model will produce better reasoning if you give it an explicit analytical sequence to follow:

```
<reasoning_protocol>
Before producing JSON, work through these phases IN ORDER. Do not skip phases.

Phase 1 — REGIME INTAKE
  State the operative_regime, secondary_regime weight, debasement_overlay signal,
  and final_confidence. Apply the confidence_gate table and state the maximum
  action level permitted.

Phase 2 — POSITION TRIAGE
  For each position: state regime_match, check threshold_monitor, check
  stop_proximity (if snapshot available). Flag any position where the
  thesis_invalidation condition is currently met or within 10%.

Phase 3 — CONFLICT MAPPING
  Identify all pairs of positions where regime_match sets are disjoint or
  where the debasement_overlay creates a structural conflict. State each
  conflict and whether it is resolved, monitoring, or acute.

Phase 4 — ACTION GENERATION
  Generate suggested_action for each position, applying confidence_gate and
  sizing_rules. Confirm that no Exit is generated on macro_core without a
  hard threshold breach when confidence < 70%.

Phase 5 — PORTFOLIO ANALYTICS
  Calculate regime_exposure_pct, correlation_cluster_exposure, and
  concentration_flags from the generated actions (not from raw config).

Phase 6 — PRIORITY RANKING
  Rank actions by: (1) hard stop proximity, (2) thesis invalidation condition
  met, (3) urgency level, (4) position size. Top 3 become priority_actions.

Phase 7 — FASTEST PATH TO BEING WRONG
  State the single scenario that would make the entire rebalancing recommendation
  incorrect within 30 days. This must be a specific, plausible event — not a
  generic disclaimer.
</reasoning_protocol>
```

### 5.2 — Telegram Report Template Note

Since the Telegram output is the human-readable layer, add a `telegram_summary` field to the portfolio output — a 200-word plain-language digest that can be sent directly:

```json
"telegram_summary": {
  "headline": "Boundary Zone — Stagflation leans 54% | Debasement Active | Confidence 70%",
  "key_actions": ["Exit TLT — hard stop breached (30Y yield 5.11%)", "Hold GLD — thesis intact", "Watch SM — stop within 5%"],
  "biggest_risk": "Energy cluster (XLE/SM/ILF/DBA) = 35% of book; single-factor unwind risk if oil reverses",
  "next_catalyst": "NFP report — below 100k confirms stagflation; above 150k re-opens Inflationary Boom"
}
```

---

## Summary Priority Table

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | Confidence-gated action rules in portfolio prompt | 🔴 Critical | Low |
| 2 | Regime probability distribution (replace binary) | 🔴 Critical | Medium |
| 3 | Debasement overlay as scored dimension | 🔴 Critical | Medium |
| 4 | Regime smoothing / persistence layer | 🟠 High | Medium |
| 5 | Empty snapshot fallback logic | 🟠 High | Low |
| 6 | Add leading indicators (yield curve, HY spreads, LEI) | 🟠 High | Medium |
| 7 | Boundary zone structured playbook | 🟠 High | Low |
| 8 | Action magnitude to Trim/Add/Exit | 🟡 Medium | Low |
| 9 | Aggregate portfolio analytics block | 🟡 Medium | Medium |
| 10 | Options/derivatives position type | 🟡 Medium | Low |
| 11 | Structured thesis_conflicts array | 🟡 Medium | Low |
| 12 | Chain-of-thought forcing protocol | 🟡 Medium | Low |
| 13 | Telegram summary field | 🟢 Low | Low |
| 14 | Correlation cluster tags on positions | 🟢 Low | Low |
