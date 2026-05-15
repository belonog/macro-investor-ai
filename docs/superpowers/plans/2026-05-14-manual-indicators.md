# Manual Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a utility to manage non-API macroeconomic indicators stored in a local JSON cache.

**Architecture:** A stateless utility module that interacts with `src/data/cache/manual_indicators.json`. It uses Zod for validation and ensures the storage directory exists.

**Tech Stack:** TypeScript, Zod, Vitest, Node.js `fs` modules.

---

### Task 1: Update Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add ManualIndicatorSchema and type**

```typescript
export const ManualIndicatorSchema = z.object({
  value: z.number(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  updatedAt: z.string().datetime(),
  source: z.string(),
});
export type ManualIndicator = z.infer<typeof ManualIndicatorSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ManualIndicator schema and type"
```

---

### Task 2: Implement Utility and Tests (TDD)

**Files:**
- Create: `src/utils/manualIndicators.ts`
- Create: `tests/manualIndicators.test.ts`

- [ ] **Step 1: Write failing tests for manual indicators utility**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getManualIndicators, setManualIndicator } from '../src/utils/manualIndicators';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'src/data/cache');
const CACHE_FILE = path.join(CACHE_DIR, 'manual_indicators.json');

describe('manualIndicators utility', () => {
  beforeEach(() => {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  });

  it('should return an empty object if cache file does not exist', () => {
    const indicators = getManualIndicators();
    expect(indicators).toEqual({});
  });

  it('should set and get a manual indicator', () => {
    const indicator = {
      value: 51.6,
      period: '2026-05',
      updatedAt: new Date().toISOString(),
      source: 'ismworld.org',
    };
    setManualIndicator('ism_services', indicator);
    
    const indicators = getManualIndicators();
    expect(indicators.ism_services).toEqual(indicator);
  });

  it('should handle multiple indicators', () => {
    const ind1 = { value: 51.6, period: '2026-05', updatedAt: new Date().toISOString(), source: 's1' };
    const ind2 = { value: 128.3, period: '2026-04', updatedAt: new Date().toISOString(), source: 's2' };
    
    setManualIndicator('ism_services', ind1);
    setManualIndicator('fao_food_price_index', ind2);
    
    const indicators = getManualIndicators();
    expect(indicators.ism_services).toEqual(ind1);
    expect(indicators.fao_food_price_index).toEqual(ind2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest tests/manualIndicators.test.ts`
Expected: FAIL (module not found or functions not exported)

- [ ] **Step 3: Implement minimal code in src/utils/manualIndicators.ts**

```typescript
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ManualIndicator, ManualIndicatorSchema } from '../types';

const CACHE_DIR = path.join(process.cwd(), 'src/data/cache');
const CACHE_FILE = path.join(CACHE_DIR, 'manual_indicators.json');

export function getManualIndicators(): Record<string, ManualIndicator> {
  if (!fs.existsSync(CACHE_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return z.record(z.string(), ManualIndicatorSchema).parse(parsed);
  } catch (error) {
    console.error('Error reading manual indicators:', error);
    return {};
  }
}

export function setManualIndicator(key: string, value: ManualIndicator): void {
  const indicators = getManualIndicators();
  indicators[key] = value;
  
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  fs.writeFileSync(CACHE_FILE, JSON.stringify(indicators, null, 2));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest tests/manualIndicators.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/manualIndicators.ts tests/manualIndicators.test.ts
git commit -m "feat: implement manualIndicators utility and tests"
```

---

### Task 3: Final Verification and Clean-up

- [ ] **Step 1: Run all tests to ensure no regressions**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Final commit**

```bash
git commit --allow-empty -m "chore: manual indicators implementation complete"
```
