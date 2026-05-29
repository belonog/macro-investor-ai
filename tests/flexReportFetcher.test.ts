import { describe, it, expect, vi } from 'vitest';
import { parseFlexXml, fetchPortfolioSnapshot } from '../src/data/fetchers/flexReportFetcher.js';
import axios from 'axios';

vi.mock('axios');

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
      avg_cost: 90,
      market_price: 88,
      market_value: 8800,
      unrealized_pnl: -200,
    });
    expect(result[0].unrealized_pnl_pct).toBeCloseTo(-2.2222, 4);
    expect(result[0].fetched_at).toBeDefined();
  });
});

describe('fetchPortfolioSnapshot', () => {
  it('should fetch and parse portfolio snapshot', async () => {
    const mockedAxios = vi.mocked(axios);
    
    // Mock SendRequest
    mockedAxios.get.mockResolvedValueOnce({
      data: '<FlexStatementResponse><Status>Success</Status><ReferenceCode>12345</ReferenceCode></FlexStatementResponse>'
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
