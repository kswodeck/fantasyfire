// GET /api/v1/search?q=&limit=
//
// Site-wide player search across every league — the header typeahead's only
// backend. Sits at /api/v1/search (not under /[sport]) precisely because it is
// cross-sport: a reader who wants "Judge" shouldn't have to pick a league first.
import type { NextRequest } from 'next/server';
import { siteSearchQuerySchema } from '@/lib/schemas';
import { searchPlayersAllSports } from '@/lib/server/players';
import { jsonResponse, preflight } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = siteSearchQuerySchema.safeParse(params);
  if (!parsed.success) {
    // A too-short/absent query is the normal state of an empty search box, not an
    // error worth surfacing — answer with an empty result set the client can render.
    return jsonResponse({ players: [] }, { request, cacheSeconds: 300 });
  }

  const { q, limit } = parsed.data;
  try {
    const players = await searchPlayersAllSports(q, limit);
    // Rosters change at most daily (ingest cadence), and popular queries repeat
    // heavily across users — let the CDN coalesce them, matching the sibling
    // /[sport]/players route.
    return jsonResponse({ players }, { request, cacheSeconds: 300 });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
