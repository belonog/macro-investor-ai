# Refactor rebalancingAgent.ts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `rebalancingAgent.ts` to use the standardized `baseAgent.generateAgentResponse` method and inject portfolio context into the system prompt.

**Architecture:** 
- Use `generateAgentResponse` from `baseAgent.ts` for AI interactions.
- Use `buildPortfolioContext` from `src/utils/portfolioContext.ts` to enrich the system prompt.
- Maintain existing stale-data guard, DB logging, and caching.

**Tech Stack:** TypeScript, Vercel AI SDK (via baseAgent), Vitest for testing.

---

### Task 1: Update Rebalancing System Prompt

**Files:**
- Modify: `src/prompts/rebalancing_system.txt`

- [ ] **Step 1: Add PORTFOLIO_CONTEXT placeholder**

Add the following section to `src/prompts/rebalancing_system.txt` after the `QUADRANT DEFINITIONS` section:

```text
PORTFOLIO_CONTEXT:
{{PORTFOLIO_CONTEXT}}
```

### Task 2: Refactor rebalancingAgent.ts

**Files:**
- Modify: `src/agents/rebalancingAgent.ts`

- [ ] **Step 1: Update imports**

Remove `GoogleGenAI` and add `generateAgentResponse`, `buildPortfolioContext`, and `PortfolioConfigSchema`.

```typescript
import {
  RebalancingOutput,
  RebalancingOutputSchema,
  RegimeAssessment,
  PositionSnapshot,
  PortfolioConfig,
  PortfolioConfigSchema // Add this
} from '../types';
import { dbManager } from './db';
import { generateAgentResponse } from './baseAgent'; // Add this
import { buildPortfolioContext } from '../utils/portfolioContext'; // Add this
import { StaleRegimeError } from '../utils/errors';
```

- [ ] **Step 2: Inject Portfolio Context into system prompt**

In `generateRebalancingReport`, load the positions config and inject it into the prompt.

```typescript
    let systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');

    // Load Positions Config (Theses, types, etc.)
    if (!fs.existsSync(POSITIONS_CONFIG_PATH)) {
      throw new Error(`Positions config not found at ${POSITIONS_CONFIG_PATH}`);
    }
    const positionsConfig: PortfolioConfig = PortfolioConfigSchema.parse(
      JSON.parse(fs.readFileSync(POSITIONS_CONFIG_PATH, 'utf8'))
    );

    // Inject Portfolio Context
    const portfolioContext = buildPortfolioContext(positionsConfig);
    systemPrompt = systemPrompt.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);
```

- [ ] **Step 3: Replace AI call with generateAgentResponse**

```typescript
    const promptContext = {
      regime_assessment: regimeSnapshot,
      portfolio_snapshot: positionSnapshots,
      positions_config: positionsConfig,
    };

    const validated = await generateAgentResponse<RebalancingOutput>({
      agentName: 'rebalancingAgent',
      trigger: 'manual', // or appropriate trigger
      systemPrompt,
      prompt: `Context:\n${JSON.stringify(promptContext, null, 2)}`,
      schema: RebalancingOutputSchema,
    });
```

- [ ] **Step 4: Update DB logging and caching**

Ensure `dbManager.logRebalancingDecision` uses the `validated` object and its `evaluated_at` field.

### Task 3: Update Tests

**Files:**
- Modify: `tests/rebalancingAgent.test.ts`

- [ ] **Step 1: Mock generateAgentResponse**

```typescript
const { mockGenerateAgentResponse } = vi.hoisted(() => ({
  mockGenerateAgentResponse: vi.fn()
}));

vi.mock('../src/agents/baseAgent', () => ({
  generateAgentResponse: mockGenerateAgentResponse
}));
```

- [ ] **Step 2: Update "should generate rebalancing report using Gemini API" test**

Update the test to check if `generateAgentResponse` was called with the correct parameters, including the injected portfolio context.

- [ ] **Step 3: Run tests**

Run: `pnpm vitest tests/rebalancingAgent.test.ts --run`
Expected: PASS
