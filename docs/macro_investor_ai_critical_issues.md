This is a well-architected two-layer system with some genuinely solid design choices — the Phase 1 / Phase 2 separation, the petrodollar decoupling signal spec, and the `confidence_adjustment` concept are all strong. But there are several layers of improvements worth addressing. Let me go through them by priority.

---

## Critical Issues (Meaningful Quality Impact)

### 1. No Reasoning Scratchpad Before JSON Output

This is the single highest-impact change you can make. You're asking the model to do complex multi-step qualitative analysis — then immediately compress all of it into structured JSON. For Sonnet this suppresses reasoning depth; for Flash it's actively harmful to output quality.

**Fix:** Add an explicit scratchpad section *before* the JSON, and tell the model to reason there first:

```
Before producing JSON output, write a <reasoning> block. Work through
each phase step by step in plain language. The JSON must reflect your
reasoning — do not add conclusions in JSON that aren't grounded in your
<reasoning> block.
```

This also makes your manual review dramatically easier — you can audit *why* the model reached a conclusion, not just what it concluded.

---

### 2. Instruction Conflict: "Don't Recompute" vs. "Cross-Reference Raw Values"

Your role definition says *"Your job is NOT to recompute these scores"* — then Step 2 immediately asks the model to cross-reference raw values against normalized scores. This creates a conflicted instruction state, especially in Flash, which will sometimes just quietly recompute anyway.

**Fix:** Reframe Step 2 explicitly:

> "You are not recalculating scores. You are sanity-checking: given the raw values shown, do the normalized scores seem directionally plausible? Flag any case where the raw value and normalized score appear inconsistent — e.g., a raw value that looks extreme but maps to a mid-range normalized score, which might indicate a normalization range artifact."

That's meaningfully different from "cross-reference" and removes the ambiguity.

---

### 3. `confidence_adjustment` Has No Calibration Anchor

The field exists and the range is defined (-10 to +10), but there are no anchor points. The model will use it inconsistently across runs and models — Opus might give a -3 for the same signal that Flash gives a -8.

**Fix:** Add a calibration table directly in the prompt:

```
Calibration:
  ±1–3  Minor caveat; one indicator slightly contradicts the classification
  ±4–6  Material qualitative signal the quant model structurally cannot capture
         (e.g., geopolitical distortion, policy transmission lag)
  ±7–10 Fundamental contradiction — qualitative read suggests a different
         quadrant entirely
  0     Quant output fully consistent with qualitative judgment
```

---

### 4. SGOV False-Positive Conflict Detection

Your pipeline flags SGOV (a cash proxy / multi-regime hedge) as conflicting with every stagflation position. This is technically correct by the detection logic but analytically meaningless — it will pollute Step 6's "most critical conflict" output with noise every single run.

**Fix (two options):**

- **Option A (cleaner):** Add an `instrument_type` metadata field — `"type": "regime_agnostic_hedge"` — and instruct the model to exclude regime-agnostic instruments from critical conflict identification. Apply the same to SGOV, and potentially SCHP as a partial hedge.
- **Option B (simpler):** Pre-filter these in the pipeline before passing `DETECTED THESIS CONFLICTS` to the LLM, so it never sees the SGOV noise.

---

## Data Gaps (What's Missing That Would Materially Improve Analysis)

### High-Value Additions

| Indicator | Why It Matters |
|---|---|
| **Core CPI YoY** (ex-food/energy) | Your model only has headline CPI. Core is what the Fed actually targets. Shelter/OER alone is ~35% of CPI and significantly lags — separating core gives the model a better read on underlying vs. transitory inflation |
| **Core PCE YoY** | Same logic — Fed's actual preferred gauge, not headline PCE |
| **30Y yield 3-month change** | Critical for petrodollar analysis. A point-in-time 30Y yield of 5.14% tells you nothing about direction. Did it rise from 4.80%? 5.00%? This is the single most important missing data point for Steps 7 and 8 |
| **DXY 3-month % change** | Same problem — 119.28 is a data point, not a trend. Is it rising or falling? The petrodollar debasement signal requires *direction*, not level |
| **Gold 3-month % change** | $4,546 tells the model gold is high; it doesn't tell it whether it's accelerating. The debasement thesis is about *rate of change* |
| **Initial Jobless Claims (4-week avg)** | High-frequency labor signal. NFP 3M avg at 48K is deeply weak — claims would tell you whether this is deteriorating further in real time |
| **Senior Loan Officer Survey (SLOOS)** — % net tightening standards | Credit impulse data. The HY spread at 2.86% looks benign but SLOOS would tell you if banks are quietly tightening credit access, which leads HY spreads by 2-3 quarters |
| **Import Price Index YoY** | Tariff transmission channel — your stagflation thesis depends partly on import price pass-through. This directly quantifies it |

### Medium-Value Additions

| Indicator | Why It Matters |
|---|---|
| **10Y TIPS real yield** | You have 5Y TIPS. Adding 10Y gives you the real yield term structure — useful when growth_score and inflation diverge across horizons |
| **Average Hourly Earnings YoY (AHE)** | You have real wages derived from ECI, but AHE is the Fed's short-cycle wage signal and is released monthly with NFP |

---

## Structural / Architectural Improvements

### 5. `additional_context` Needs a Documented Schema

Right now it's `{}` — an empty object with no guidance. This means the human operator has to know to put something in it, and the model doesn't know what to expect. For a system you might run on a schedule, this will often just be empty.

**Fix:** Define the schema explicitly in the prompt and in the pipeline:

```json
"additional_context": {
  "geopolitical_events": ["Iran Hormuz disruption ongoing, ~25% shipping risk"],
  "policy_signals": ["Fed on hold, next meeting June 18"],
  "structural_breaks": ["Tariff regime shift April 2026"],
  "analyst_notes": "free text field for human operator override"
}
```

Even if most fields are empty most of the time, giving them named slots means the model knows where to look and the human knows what to fill in.

---

### 6. "Nuanced" Verdict Swallows Everything

The three verdict options are `Confirmed`, `Challenged`, and `Nuanced`. In practice, almost every non-trivial macro situation will land in `Nuanced` because there are almost always caveats. This reduces the field to noise.

**Fix:** Narrow the definition:

> `Nuanced` = directionally confirmed, **but** a specific structural factor (geopolitical premium, data lag, policy transmission gap) causes the regime to *behave differently from historical precedent* for this quadrant. The model should name the specific factor.

Also consider adding a `strength` field: `"Confirmed-Strong" / "Confirmed-Weak" / "Nuanced" / "Challenged"` — this gives you a 4-point scale instead of 3, which is more actionable.

---

### 7. Missing Output Fields Worth Adding

Three fields would meaningfully improve your manual review:

**`regime_momentum`** — Is the current regime strengthening or weakening? Even if drift_delta is 0,0, the direction of individual indicator movement matters. A simple `"Strengthening" / "Stable" / "Weakening"` with one sentence of rationale.

**`estimated_regime_duration`** — How many months is this regime likely to persist given current trajectory? The model won't get this right all the time, but forcing it to make an estimate sharpens the analysis and gives you something to audit.

**`tail_risk_scenario`** — Distinct from `fastest_path_to_being_wrong`. That field covers the most *likely* invalidation. This covers the low-probability, high-impact scenario (e.g., "Iran conflict escalates to Strait closure, oil spikes to $160, stagflation becomes unambiguous").

---

## Minor but Worth Fixing

- **`hy_spread_bps` is mislabeled** in your data — it shows 2.86 and is labeled "basis points OAS" but the value is in percentage points (286 bps). The model will occasionally get confused by this unit inconsistency, especially when comparing to `ig_spread_bps` at 0.76.

- **`watch_next` is capped at 3 releases** — given the complexity of a Boundary Zone regime, 4-5 is more appropriate. The current constraint forces the model to drop relevant catalysts.

- **For Flash specifically:** If you want consistent quality on Flash, consider splitting into two sequential calls — Phase 1 validation only, then pass that output as context into Phase 2 portfolio analysis. Flash's reasoning quality degrades noticeably on long multi-phase single-pass instructions.

---

## Summary Priority Order

| Priority | Change | Impact |
|---|---|---|
| 1 | Add `<reasoning>` scratchpad before JSON | Highest — improves reasoning quality across all models |
| 2 | Add 30Y yield trend + DXY trend + gold trend | Petrodollar analysis is currently data-starved |
| 3 | Add core CPI / core PCE | Inflation regime classification is missing the Fed-relevant signal |
| 4 | Calibrate `confidence_adjustment` | Consistency across models and runs |
| 5 | Fix SGOV false-positive conflicts | Cleans up Step 6 noise |
| 6 | Clarify "sanity-check vs. recompute" | Removes instruction conflict |
| 7 | Add SLOOS + import price index | Fills key leading-indicator gaps |
| 8 | Schema for `additional_context` | Enables systematic geopolitical injection |
| 9 | Restructure `Nuanced` verdict | Prevents verdict inflation |
| 10 | Add `regime_momentum`, `tail_risk_scenario` fields | Richer manual review |
