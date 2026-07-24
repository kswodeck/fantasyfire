// GET /api/v1/{sport}/players?q=&limit=
//
// Player search/list for the website's search box and any future client.
import type { NextRequest } from 'next/server';
import { playersQuerySchema } from '@/lib/schemas';
import { searchPlayers } from '@/lib/server/players';
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
  const parsed = playersQuerySchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400, request },
    );
  }

  const { q, limit } = parsed.data;
  try {
    const players = await searchPlayers(sport, q, limit);
    // Roster changes at most daily (ingest cadence), so let the CDN coalesce bursts
    // of identical search-box queries and repeat crawls to one origin hit — matching
    // the sibling hitrate/topreads routes. 5 min is invisible for a ~daily dataset
    // (with stale-while-revalidate the CDN never blocks on a refresh).
    return jsonResponse({ players }, { request, cacheSeconds: 300 });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
