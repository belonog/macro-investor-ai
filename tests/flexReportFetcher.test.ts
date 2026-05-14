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
