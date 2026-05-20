import { XMLParser } from 'fast-xml-parser';
import axios from 'axios';
import { PositionSnapshot, PositionSnapshotSchema } from '../../types/index.js';
import { withRetry } from '../../utils/retry.js';

export function parseFlexXml(xml: string): PositionSnapshot[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const jsonObj = parser.parse(xml);
  const statements = jsonObj.FlexQueryResponse.FlexStatements.FlexStatement;
  
  if (!statements || !statements.OpenPositions) {
    return [];
  }

  const positions = Array.isArray(statements.OpenPositions.OpenPosition) 
    ? statements.OpenPositions.OpenPosition 
    : [statements.OpenPositions.OpenPosition];

  const fetchedAt = new Date().toISOString();

interface OpenPosition {
  symbol: string;
  position: string;
  costBasisPrice: string;
  fifoPnlUnrealized: string;
  markPrice: string;
  positionValue: string;
}

  return positions.filter((p: OpenPosition) => p !== undefined).map((p: OpenPosition) => {
    const quantity = parseFloat(p.position);
    const avgCost = parseFloat(p.costBasisPrice);
    const unrealizedPnl = parseFloat(p.fifoPnlUnrealized);
    const costBasis = quantity * avgCost;
    const unrealizedPnlPct = costBasis !== 0 ? (unrealizedPnl / Math.abs(costBasis)) * 100 : 0;

    return PositionSnapshotSchema.parse({
      symbol: p.symbol,
      quantity,
      avg_cost: avgCost,
      market_price: parseFloat(p.markPrice),
      market_value: parseFloat(p.positionValue),
      unrealized_pnl: unrealizedPnl,
      unrealized_pnl_pct: unrealizedPnlPct,
      fetched_at: fetchedAt,
    });
  });
}

export async function fetchPortfolioSnapshot(token: string, queryId: string): Promise<PositionSnapshot[]> {
  const baseUrl = 'https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest';
  const response = await withRetry(() => axios.get(`${baseUrl}?t=${token}&q=${queryId}&v=3`));
  
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const statusObj = parser.parse(response.data);
  
  if (!statusObj.FlexStatus || statusObj.FlexStatus.Status !== 'Success') {
    throw new Error(`Flex report request failed: ${statusObj.FlexStatus?.Status || 'Unknown error'}`);
  }

  const referenceCode = statusObj.FlexStatus.ReferenceCode;
  const getStatementUrl = 'https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement';
  
  let dataReady = false;
  let reportData = '';
  
  while (!dataReady) {
    const statementResponse = await withRetry(() => axios.get(`${getStatementUrl}?t=${token}&q=${referenceCode}&v=3`));
    if (typeof statementResponse.data === 'string' && statementResponse.data.includes('FlexQueryResponse')) {
      reportData = statementResponse.data;
      dataReady = true;
    } else {
      const errorObj = parser.parse(statementResponse.data);
      if (errorObj.FlexStatus && errorObj.FlexStatus.ErrorCode === 1019) {
        // Statement not ready yet
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (errorObj.FlexStatus) {
         throw new Error(`Flex report fetch failed: ${errorObj.FlexStatus.Status}`);
      } else {
        throw new Error('Unexpected response format from IBKR Flex Service');
      }
    }
  }

  return parseFlexXml(reportData);
}
