import { z } from 'zod';
import { statKeySchema, lineSchema } from './stats';

/** Player slug as used in URLs, e.g. "lebron-james". */
export const playerSlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens');

/** A provided-line source id (book), e.g. "prizepicks". Lowercase id-ish. */
export const providedSourceSchema = z
  .string()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'Invalid source');

/**
 * Query for GET /api/v1/hitrate?playerSlug=&stat=&line=&source=
 * `line` is optional — when omitted the server uses the chosen book's line, else
 * the stat's season median to 0.5. `source` picks which book's line to prefer.
 */
export const hitRateQuerySchema = z.object({
  playerSlug: playerSlugSchema,
  stat: statKeySchema,
  line: lineSchema.optional(),
  source: providedSourceSchema.optional(),
  // The selected rung's payout context (see RungHint) — keeps a clicked variant
  // scored against ITS payout even when the book has re-priced/pulled that rung
  // since the caller rendered. Only meaningful alongside an explicit `line`.
  oddsType: z
    .string()
    .max(20)
    .regex(/^[a-z_]+$/, 'Invalid oddsType')
    .optional(),
  multiplier: z.coerce.number().positive().max(100).optional(),
});
export type HitRateQuery = z.infer<typeof hitRateQuerySchema>;

/** Query for GET /api/v1/players?q=&limit= */
export const playersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PlayersQuery = z.infer<typeof playersQuerySchema>;

/** Optional stat/line/source query for the per-player REST endpoint (slug in path). */
export const playerResearchQuerySchema = z.object({
  stat: statKeySchema.optional(),
  line: lineSchema.optional(),
  source: providedSourceSchema.optional(),
});
export type PlayerResearchQuery = z.infer<typeof playerResearchQuerySchema>;

/** Query for GET /api/v1/{sport}/topreads?playerSlug=&source= — one player's
 *  strongest prop+line combos (the player-page mini dashboard). */
export const topReadsQuerySchema = z.object({
  playerSlug: playerSlugSchema,
  source: providedSourceSchema.optional(),
});
export type TopReadsQuery = z.infer<typeof topReadsQuerySchema>;

/** Body for POST /api/v1/{sport}/slate — the user's pasted prop lines. */
export const slateBodySchema = z.object({
  text: z.string().min(1).max(8000),
});
export type SlateBody = z.infer<typeof slateBodySchema>;
