# Design: Manual Indicators Utility

Implement `src/utils/manualIndicators.ts` to manage macroeconomic indicators that are not available via REST APIs (e.g., ISM Services, FAO Food Price Index).

## Architecture

- **Storage:** `src/data/cache/manual_indicators.json` (JSON record of indicator keys to `ManualIndicator` objects).
- **Interface:**
    - `getManualIndicators()`: Returns all stored manual indicators.
    - `setManualIndicator(key: string, value: ManualIndicator)`: Updates or adds an indicator.
- **Validation:** Use Zod schema (`ManualIndicatorSchema`) for data integrity.

## Data Schema (to be added to `src/types/index.ts`)

```typescript
export const ManualIndicatorSchema = z.object({
  value: z.number(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  updatedAt: z.string().datetime(),
  source: z.string(),
});
export type ManualIndicator = z.infer<typeof ManualIndicatorSchema>;
```

## Implementation Details

- `getManualIndicators()`:
    - Check if `src/data/cache/manual_indicators.json` exists.
    - If not, return an empty object `{}`.
    - If it exists, read and parse. Validate with `z.record(z.string(), ManualIndicatorSchema)`.
- `setManualIndicator()`:
    - Load current indicators.
    - Update the key with the new value.
    - Save back to `src/data/cache/manual_indicators.json`.
    - Ensure directories exist.

## Testing Strategy

- Unit tests in `tests/manualIndicators.test.ts`.
- Test reading from non-existent file.
- Test writing and reading back.
- Test validation failures (invalid period, invalid updatedAt).
