# FRED Fetcher Implementation Progress

## Task 1: Define Data Schemas
- [x] Step 1: Add DataPoint schema to `src/data/types.ts`
- [x] Step 2: Add tests for new schemas in `tests/types.test.ts`
- [x] Step 3: Run tests and commit (`feat: add DataPoint and MacroSnapshot schemas`)

## Task 2: Implement FRED API Client
- [ ] Step 1: Write test for fetchSeries in `tests/fredFetcher.test.ts`
- [ ] Step 2: Implement fetchSeries in `src/data/fetchers/fredFetcher.ts`
- [ ] Step 3: Run tests and commit (`feat: implement fetchSeries in fredFetcher`)

## Task 3: Implement Bulk Fetching and Caching
- [ ] Step 1: Define Target Basket and Implement `fetchAll` in `src/data/fetchers/fredFetcher.ts`
- [ ] Step 2: Implement Caching Logic in `updateMacroCache`
- [ ] Step 3: Add `getLatestValues` convenience method
- [ ] Step 4: Run tests and commit (`feat: add bulk fetching and caching to fredFetcher`)
