import { z } from 'zod';
import { statKeySchema, lineSchema } from './stats';

/** Player slug as used in URLs, e.g. "lebron-james". */
export const playerSlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens');

/**
 * Query for GET /api/v1/hitrate?playerSlug=&stat=&line=
 * `line` is optional — when omitted the server uses the stat's season average
 * rounded to 0.5 (useful when switching stats client-side).
 */
export const hitRateQuerySchema = z.object({
  playerSlug: playerSlugSchema,
  stat: statKeySchema,
  line: lineSchema.optional(),
});
export type HitRateQuery = z.infer<typeof hitRateQuerySchema>;

/** Query for GET /api/v1/players?q=&limit= */
export const playersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PlayersQuery = z.infer<typeof playersQuerySchema>;

/** Optional stat/line query for the per-player REST endpoint (slug is in the path). */
export const playerResearchQuerySchema = z.object({
  stat: statKeySchema.optional(),
  line: lineSchema.optional(),
});
export type PlayerResearchQuery = z.infer<typeof playerResearchQuerySchema>;
