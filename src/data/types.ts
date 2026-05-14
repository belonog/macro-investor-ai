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

export const DataPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  value: z.number(),
});

export type DataPoint = z.infer<typeof DataPointSchema>;

export const MacroSnapshotSchema = z.record(z.string(), z.array(DataPointSchema));
export type MacroSnapshot = z.infer<typeof MacroSnapshotSchema>;

export const MacroCacheSchema = z.object({
  fetchedAt: z.string().datetime(),
  data: MacroSnapshotSchema,
});
export type MacroCache = z.infer<typeof MacroCacheSchema>;

export const RegimeQuadrantSchema = z.enum([
  'Goldilocks',
  'Inflationary Boom',
  'Stagflation',
  'Deflationary Recession',
]);
export type RegimeQuadrant = z.infer<typeof RegimeQuadrantSchema>;

export const RegimeSnapshotSchema = z.object({
  quadrant: RegimeQuadrantSchema,
  confidence: z.number().min(0).max(100),
  keyDrivers: z.array(z.string()).describe('Bullet points explaining the classification'),
  transitionSignal: z.string().optional().describe('Warning of an impending shift, if any'),
  evaluatedAt: z.string().datetime(),
});
export type RegimeSnapshot = z.infer<typeof RegimeSnapshotSchema>;
