import { z } from 'zod';

export const PositionSnapshotSchema = z.object({
  symbol: z.string(),
  quantity: z.number(),
  avgCost: z.number(),
  marketPrice: z.number(),
  marketValue: z.number(),
  unrealizedPnl: z.number(),
  unrealizedPnlPct: z.number(),
  fetchedAt: z.string().datetime(),
});

export type PositionSnapshot = z.infer<typeof PositionSnapshotSchema>;

export const AlertSchema = z.object({
  level: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  symbol: z.string().optional(),
  message: z.string(),
  action: z.string().optional(),
});

export type Alert = z.infer<typeof AlertSchema>;
