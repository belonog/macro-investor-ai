# Indicator Refinement Design
Date: 2026-05-15

## 1. Overview
The current regime detection engine relies on multiple macroeconomic data sources (BLS, EIA, FRED, Polygon). Recent additions from the EIA (commodity spot prices) have proven inconsistent due to the complexity of regional and volume-based API facets. This design refines the data sourcing strategy to utilize the cleanest available API for each metric type and adds critical labor market data to improve the accuracy of the growth and inflation regime scoring.

## 2. Data Sourcing Re-Alignment

### 2.1 FRED Fetcher (`fredFetcher.ts`)
**Purpose:** Handle all clean, aggregated historical macro series and spot commodity prices.
- **Additions:**
  - `DCOILWTICO`: WTI Crude Oil Spot Price (replaces EIA spot price)
  - `DHHNGSP`: Henry Hub Natural Gas Spot Price (replaces EIA spot price)

### 2.2 EIA Fetcher (`eiaFetcher.ts`)
**Purpose:** Exclusively handle fundamental supply-side physical market data.
- **Refocused Endpoints:**
  - Weekly U.S. Ending Stocks of Commercial Crude Oil (Inventory)
  - Weekly U.S. Field Production of Crude Oil (Production)

### 2.3 BLS Fetcher (`blsFetcher.ts`)
**Purpose:** Handle official labor and inflation indices.
- **Additions:**
  - `LNS14000000`: Unemployment Rate (CPS survey) - Primary growth/recession indicator.
  - `CES0500000003`: Average Hourly Earnings (CES survey) - Primary wage inflation indicator.
  - `JTU000000000000000JOL`: JOLTS Job Openings - Labor market tightness (growth indicator).

## 3. Configuration Updates

### 3.1 Regime Weights (`config/regime_weights.json`)
The regime scoring algorithm relies on normalized weights. The JSON configuration will be updated to include the new BLS indicators and properly balance the impact of the added EIA supply fundamentals.
- **Growth Indicators:** Incorporate Unemployment Rate (inverted) and JOLTS Job Openings.
- **Inflation Indicators:** Incorporate Average Hourly Earnings (replaces or runs alongside the current `eci_wages` placeholder).

## 4. Implementation Steps
1. Update `fredFetcher.ts` with the new commodity series IDs.
2. Update `eiaFetcher.ts` removing spot prices and adding production data. Update the corresponding tests.
3. Update `blsFetcher.ts` to include the new labor series IDs.
4. Update `config/regime_weights.json` to properly integrate the new data points into the scoring model.
5. Verify end-to-end extraction through tests.