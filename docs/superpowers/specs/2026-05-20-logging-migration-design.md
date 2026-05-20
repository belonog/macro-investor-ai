# Design Doc: Structured Logging Migration Completion

## 1. Problem Statement
The codebase has partially migrated to structured logging using `pino`. However, several `console.log`, `console.warn`, and `console.error` calls remain in the application logic, bypassing the structured logging system and ignoring the configured log levels.

## 2. Proposed Changes
Complete the migration by replacing all internal `console` calls with the `logger` instance from `src/utils/logger.ts`.

### 2.1 Scope
- **Migrate**: `src/agents/`, `src/data/`, `src/flows/`, `src/utils/` (excluding `logger.ts` and `cli.ts`).
- **Exclude**: `src/cli.ts` (intended for direct user interaction).
- **Exclude**: `src/config/env.ts` (avoids circular dependency during boot validation).

### 2.2 Migration Rules
| From | To |
|------|----|
| `console.log(msg)` | `logger.info(msg)` |
| `console.warn(msg, err)` | `logger.warn(err, msg)` |
| `console.error(msg, err)` | `logger.error(err, msg)` |

*Note: Pino prefers the error object as the first argument for proper serialization.*

## 3. Detailed Implementation Plan

### 3.1 `src/agents/rebalancingAgent.ts`
- Migrate or remove the legacy CLI block at the end of the file. Since `src/cli.ts` exists, migrating it to `logger` is safer than deletion if any scripts still call it directly via `tsx`.

### 3.2 `src/agents/regimeAgent.ts`
- Replace `console.warn` with `logger.warn` for config and cache parsing errors.

### 3.3 `src/data/fetchers/fredFetcher.ts`
- Replace `console.warn` with `logger.warn` for cache invalidation messages.

### 3.4 `src/data/indicators/derivation.ts`
- Replace `console.warn` with `logger.warn` for missing registry entries.

### 3.5 `src/flows/dailyDigest.ts`
- Replace `console.warn` with `logger.warn` for position parsing errors.

### 3.6 `src/flows/eventPrebrief.ts`
- Replace `console.warn` with `logger.warn` for missing positions config.

### 3.7 `src/utils/manualIndicators.ts`
- Replace `console.error` with `logger.error` for file reading errors.

## 4. Verification Plan
1. **Linting**: Ensure no new lint errors (ESLint might already have rules against `console`).
2. **Type Checking**: Run `tsc --noEmit`.
3. **Tests**: Run `pnpm test` to ensure no regressions in functionality.
4. **Log Inspection**: Manually trigger some log paths (e.g., invalid cache) to verify structured output.
