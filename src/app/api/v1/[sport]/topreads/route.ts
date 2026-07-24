// GET /api/v1/{sport}/topreads?playerSlug=&source=
//
// One player's strongest prop+line combos — the player page's "top reads" mini
// dashboard. Board-identical scoring (see getPlayerTopReads); `source` picks
// which book's lines to rank (computed lines when the book has none).
import type { NextRequest } from 'next/server';
import { topReadsQuerySchema } from '@/lib/schemas';
import { getPlayerTopReads } from '@/lib/server/players';
import { jsonResponse, preflight } from '@/lib/api';
import { isSport } from '@/lib/sports';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) {
    return jsonResponse({ error: 'Unknown sport' }, { status: 404, request });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = topReadsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400, request },
    );
  }

  const { playerSlug, source } = parsed.data;
  try {
    const rows = await getPlayerTopReads(sport, playerSlug, source);
    return jsonResponse({ rows }, { request, cacheSeconds: 300 });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
