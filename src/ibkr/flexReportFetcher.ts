import { XMLParser } from 'fast-xml-parser';
import { PositionSnapshot, PositionSnapshotSchema } from '../types/index.js';

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

  return positions.filter((p: any) => p !== undefined).map((p: any) => {
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
