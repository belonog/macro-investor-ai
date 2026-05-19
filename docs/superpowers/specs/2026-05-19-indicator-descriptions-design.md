# Indicator Descriptions Design

**Goal:** Enhance the transparency and explainability of the macro assessment by adding human-readable descriptions to all indicators.

**Architecture:**
1.  **Schema Extension**: Modify `RawIndicatorSchema` and `ManualIndicatorSchema` in `src/types/index.ts` to include a mandatory `description` field.
2.  **Fetcher Integration**:
    *   `fredFetcher.ts`: Utilize `TARGET_SERIES` metadata to populate descriptions for raw series and provide explicit descriptions for derived metrics (e.g., "Real GDP QoQ Annualized Rate (%)").
    *   `polygonFetcher.ts`: Add description to `getGoldSpotPrice`.
3.  **Manual Indicators**: Update `src/utils/manualIndicators.ts` and the underlying JSON storage to support descriptions.
4.  **Test Alignment**: Update all relevant tests to satisfy the updated schema.

**Tech Stack:** TypeScript, Zod, Vitest.

---

## 1. Schema Updates (`src/types/index.ts`)

- `RawIndicatorSchema`: Add `description: z.string()`.
- `ManualIndicatorSchema`: Add `description: z.string()`.

## 2. Fetcher Updates

### 2.1 FRED Fetcher (`src/data/fetchers/fredFetcher.ts`)

- Update `deriveMetrics` helper `wrap` to require/include `description`.
- Raw series will use `TARGET_SERIES[id].description`.
- Derived metrics will use specific strings:
    - `cpi_yoy_pct`: "Consumer Price Index (CPI) Year-over-Year % Change"
    - `pce_yoy_pct`: "Personal Consumption Expenditures (PCE) Year-over-Year % Change"
    - `ppi_yoy_pct`: "Producer Price Index (PPI) Year-over-Year % Change"
    - `breakeven_5y_pct`: "5-Year Breakeven Inflation Rate (%)"
    - `oil_price_3m_change_pct`: "WTI Crude Oil Price 3-Month % Change"
    - `real_gdp_qoq_ann_pct`: "Real GDP Quarter-over-Quarter Annualized % Change"
    - `nfp_3m_avg_k`: "Nonfarm Payrolls 3-Month Rolling Average Change (Thousands)"
    - `retail_sales_yoy_real_pct`: "Real Retail Sales Year-over-Year % Change (CPI-Adjusted)"
    - `real_wages_yoy_pct`: "Real Wages Year-over-Year % Change (ECI Wages minus CPI)"
    - `yield_curve_30_2`: "Yield Curve Spread: 30Y minus 2Y (Percentage Points)"
    - `credit_spread_delta`: "High Yield Credit Spread Delta (OAS minus 6-Month Moving Average)"

### 2.2 Polygon Fetcher (`src/data/fetchers/polygonFetcher.ts`)

- `getGoldSpotPrice`: Add `description: "Gold Spot Price (XAU/USD)"`.

## 3. Manual Indicators (`src/utils/manualIndicators.ts`)

- The schema change in `types/index.ts` will automatically affect `ManualIndicatorSchema`.
- Existing `manual_indicators.json` (if any) will need descriptions added to pass validation.

## 4. Testing & Verification

- `tests/types.test.ts`: Add `description` to mock data.
- `tests/fredFetcher.test.ts`: Add `description` to expectations and mocks.
- `tests/polygonFetcher.test.ts`: Add `description` to expectations.
- `tests/manualIndicators.test.ts`: Add `description` to mock data.
- Run `pnpm test` to verify all changes.
- Run `pnpm run lint` and `tsc --noEmit` to ensure type safety.
