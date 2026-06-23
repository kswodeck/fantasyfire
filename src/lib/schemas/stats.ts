import { z } from 'zod';
import { STAT_KEYS, type StatKey } from '@/lib/stats/types';

/** A researchable stat key (pts, reb, …, pra, stocks). */
export const statKeySchema = z.enum(STAT_KEYS as [StatKey, ...StatKey[]]);

/** A prop line: non-negative, finite, coerced from query strings. */
export const lineSchema = z.coerce
  .number()
  .finite()
  .min(0)
  .max(500);

/** American odds: non-zero integer with magnitude ≥ 100 (e.g. -110, +150). */
export const americanOddsSchema = z.coerce
  .number()
  .int()
  .refine((o) => o !== 0 && Math.abs(o) >= 100, {
    message: 'American odds must be a non-zero integer with magnitude ≥ 100',
  });

/** Analysis window. */
export const statWindowSchema = z.union([
  z.literal('season'),
  z.coerce.number().pipe(z.union([z.literal(5), z.literal(10), z.literal(20)])),
]);

export type StatKeyInput = z.infer<typeof statKeySchema>;
