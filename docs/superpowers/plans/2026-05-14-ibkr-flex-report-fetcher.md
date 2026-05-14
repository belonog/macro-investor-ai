# IBKR Flex Report Fetcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the IBKR Flex Report Fetcher to retrieve and parse portfolio snapshots from Interactive Brokers Flex Web Service.

**Architecture:** Use `axios` for HTTP requests and `fast-xml-parser` for XML parsing. The fetcher follows a two-step process: requesting the report and polling for its availability. Data is validated using `PositionSnapshotSchema`.

**Tech Stack:** TypeScript, axios, fast-xml-parser, zod, vitest.

---

### Task 1: Setup Tests and Mocks

**Files:**
- Create: `tests/flexReportFetcher.test.ts`

- [ ] **Step 1: Write initial test for XML parsing**

```typescript
import { describe, it, expect } from 'vitest';
import { parseFlexXml } from '../src/ibkr/flexReportFetcher.js';

describe('parseFlexXml', () => {
  it('should parse valid Flex XML into PositionSnapshot array', () => {
    const xml = `
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement>
      <OpenPositions>
        <OpenPosition symbol="TLT" position="100" fifoPnlUnrealized="-200" markPrice="88" costBasisPrice="90" positionValue="8800" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`;
    const result = parseFlexXml(xml);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol: 'TLT',
      quantity: 100,
      avgCost: 90,
      marketPrice: 88,
      marketValue: 8800,
      unrealizedPnl: -200,
    });
    expect(result[0].unrealizedPnlPct).toBeCloseTo(-2.2222, 4);
    expect(result[0].fetchedAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest tests/flexReportFetcher.test.ts`
Expected: FAIL (module not found or function not exported)

- [ ] **Step 3: Create src/ibkr/flexReportFetcher.ts with minimal implementation**

```typescript
import { XMLParser } from 'fast-xml-parser';
import { PositionSnapshot, PositionSnapshotSchema } from '../types/index.js';

export function parseFlexXml(xml: string): PositionSnapshot[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const jsonObj = parser.parse(xml);
  const statements = jsonObj.FlexQueryResponse.FlexStatements.FlexStatement;
  const positions = Array.isArray(statements.OpenPositions.OpenPosition) 
    ? statements.OpenPositions.OpenPosition 
    : [statements.OpenPositions.OpenPosition];

  const fetchedAt = new Date().toISOString();

  return positions.map((p: any) => {
    const quantity = parseFloat(p.position);
    const avgCost = parseFloat(p.costBasisPrice);
    const unrealizedPnl = parseFloat(p.fifoPnlUnrealized);
    const costBasis = quantity * avgCost;
    const unrealizedPnlPct = costBasis !== 0 ? (unrealizedPnl / Math.abs(costBasis)) * 100 : 0;

    return PositionSnapshotSchema.parse({
      symbol: p.symbol,
      quantity,
      avgCost,
      marketPrice: parseFloat(p.markPrice),
      marketValue: parseFloat(p.positionValue),
      unrealizedPnl,
      unrealizedPnlPct,
      fetchedAt,
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest tests/flexReportFetcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/flexReportFetcher.test.ts src/ibkr/flexReportFetcher.ts
git commit -m "feat: implement parseFlexXml for IBKR Flex reports"
```

### Task 2: Implement fetchPortfolioSnapshot

**Files:**
- Modify: `src/ibkr/flexReportFetcher.ts`
- Modify: `tests/flexReportFetcher.test.ts`

- [ ] **Step 1: Add test for fetchPortfolioSnapshot with mocked axios**

```typescript
import axios from 'axios';
import { vi } from 'vitest';
import { fetchPortfolioSnapshot } from '../src/ibkr/flexReportFetcher.js';

vi.mock('axios');

describe('fetchPortfolioSnapshot', () => {
  it('should fetch and parse portfolio snapshot', async () => {
    const mockedAxios = vi.mocked(axios);
    
    // Mock SendRequest
    mockedAxios.get.mockResolvedValueOnce({
      data: '<FlexStatus><Status>Success</Status><ReferenceCode>12345</ReferenceCode></FlexStatus>'
    });

    // Mock GetStatement
    mockedAxios.get.mockResolvedValueOnce({
      data: `
<FlexQueryResponse>
  <FlexStatements>
    <FlexStatement>
      <OpenPositions>
        <OpenPosition symbol="TLT" position="100" fifoPnlUnrealized="-200" markPrice="88" costBasisPrice="90" positionValue="8800" />
      </OpenPositions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>`
    });

    const result = await fetchPortfolioSnapshot('token', 'queryId');
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('TLT');
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest tests/flexReportFetcher.test.ts`
Expected: FAIL (fetchPortfolioSnapshot not defined)

- [ ] **Step 3: Implement fetchPortfolioSnapshot**

```typescript
import axios from 'axios';

export async function fetchPortfolioSnapshot(token: string, queryId: string): Promise<PositionSnapshot[]> {
  const baseUrl = 'https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest';
  const response = await axios.get(`${baseUrl}?t=${token}&q=${queryId}&v=3`);
  
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const statusObj = parser.parse(response.data);
  
  if (statusObj.FlexStatus.Status !== 'Success') {
    throw new Error(`Flex report request failed: ${statusObj.FlexStatus.Status}`);
  }

  const referenceCode = statusObj.FlexStatus.ReferenceCode;
  const getStatementUrl = 'https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement';
  
  // In a real scenario, we might need to poll. For now, we'll try once.
  // The implementation guide says: "repeatedly until data is ready"
  let dataReady = false;
  let reportData = '';
  
  while (!dataReady) {
    const statementResponse = await axios.get(`${getStatementUrl}?t=${token}&q=${referenceCode}&v=3`);
    if (statementResponse.data.includes('FlexQueryResponse')) {
      reportData = statementResponse.data;
      dataReady = true;
    } else {
      // Check for errors or wait
      const errorObj = parser.parse(statementResponse.data);
      if (errorObj.FlexStatus && errorObj.FlexStatus.ErrorCode === 1019) {
        // Statement not ready yet
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (errorObj.FlexStatus) {
         throw new Error(`Flex report fetch failed: ${errorObj.FlexStatus.Status}`);
      }
    }
  }

  return parseFlexXml(reportData);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest tests/flexReportFetcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/flexReportFetcher.test.ts src/ibkr/flexReportFetcher.ts
git commit -m "feat: implement fetchPortfolioSnapshot with polling"
```

### Task 3: Final Verification

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Final commit**

```bash
git commit -m "feat: complete IBKR Flex Report Fetcher implementation" --allow-empty
```
