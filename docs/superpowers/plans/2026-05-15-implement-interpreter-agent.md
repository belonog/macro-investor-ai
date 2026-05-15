# Interpreter Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Interpreter Agent which analyzes raw economic release data and produces structured output.

**Architecture:** The agent will use the `generateAgentResponse` from `baseAgent.ts`, injecting portfolio context into the `interpreter_system.txt` prompt.

**Tech Stack:** TypeScript, Vercel AI SDK, Vitest

---

### Task 1: Create Interpreter Agent implementation

**Files:**
- Create: `src/agents/interpreterAgent.ts`

- [ ] **Step 1: Write the failing test**

We will start with the test. Create `tests/interpreterAgent.test.ts`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockGenerateAgentResponse } = vi.hoisted(() => ({
  mockGenerateAgentResponse: vi.fn()
}));

vi.mock('../src/agents/baseAgent', () => ({
  generateAgentResponse: mockGenerateAgentResponse
}));

vi.mock('fs');

import { runInterpreterAgent } from '../src/agents/interpreterAgent';

describe('InterpreterAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.includes('interpreter_system.txt')) {
        return 'Mock Prompt with {{PORTFOLIO_CONTEXT}}';
      }
      return '';
    });
  });

  it('should analyze release data and return structured output', async () => {
    const mockOutput = {
      confirms: ['Growth is strong'],
      contradicts: ['Inflation is falling'],
      ambiguous: ['Wage growth'],
      resolution_requirement: 'Wait for next CPI',
      summary_markdown: '# Summary\nGrowth is strong but inflation is sticky.'
    };

    mockGenerateAgentResponse.mockResolvedValue(mockOutput);

    const result = await runInterpreterAgent(
      'Non-Farm Payrolls',
      'NFP: 300k, Unemployment: 3.8%',
      {}
    );

    expect(result).toEqual(mockOutput);
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'InterpreterAgent',
      systemPrompt: expect.stringContaining('Mock Prompt'),
      prompt: expect.stringContaining('Non-Farm Payrolls')
    }));
  });

  it('should inject portfolio context into system prompt', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (typeof filePath === 'string' && filePath.includes('interpreter_system.txt')) {
        return 'PROMPT: {{PORTFOLIO_CONTEXT}}';
      }
      return '';
    });

    mockGenerateAgentResponse.mockResolvedValue({
      confirms: [],
      contradicts: [],
      ambiguous: [],
      resolution_requirement: 'None',
      summary_markdown: 'None'
    });

    const mockPositions = {
      'AAPL': {
        shares: 10,
        avg_cost: 150,
        position_type: 'equity_single' as const,
        thesis: 'Good company',
        regime_match: ['Goldilocks' as const],
        thesis_invalidation: 'Bad earnings'
      }
    };

    await runInterpreterAgent('Test Release', 'Test Data', mockPositions);

    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.stringContaining('AAPL')
    }));
    expect(mockGenerateAgentResponse).toHaveBeenCalledWith(expect.objectContaining({
      systemPrompt: expect.not.stringContaining('{{PORTFOLIO_CONTEXT}}')
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest tests/interpreterAgent.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Create `src/agents/interpreterAgent.ts`.

```typescript
import fs from 'fs';
import path from 'path';
import { generateAgentResponse } from './baseAgent';
import { InterpreterOutput, InterpreterOutputSchema, PortfolioConfig } from '../types';
import { buildPortfolioContext } from '../utils/portfolioContext';

export async function runInterpreterAgent(
  releaseName: string,
  releaseData: string,
  positionsConfig: PortfolioConfig
): Promise<InterpreterOutput> {
  const templatePath = path.join(process.cwd(), 'src/prompts/interpreter_system.txt');
  const template = fs.readFileSync(templatePath, 'utf-8');
  
  const portfolioContext = buildPortfolioContext(positionsConfig);
  const systemPrompt = template.replace('{{PORTFOLIO_CONTEXT}}', portfolioContext);

  const userPrompt = `Data Release: ${releaseName}\n\nRaw Data:\n${releaseData}`;

  return await generateAgentResponse({
    systemPrompt,
    prompt: userPrompt,
    schema: InterpreterOutputSchema,
    agentName: 'InterpreterAgent',
    trigger: 'manual'
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest tests/interpreterAgent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agents/interpreterAgent.ts tests/interpreterAgent.test.ts
git commit -m "feat: implement interpreter agent"
```
