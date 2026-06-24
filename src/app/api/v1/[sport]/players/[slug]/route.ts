// GET /api/v1/{sport}/players/[slug]?stat=&line=
//
// RESTful per-player research payload (same data as /api/v1/{sport}/hitrate,
// keyed by a path slug) — convenient for a future mobile client.
import type { NextRequest } from 'next/server';
import { getPlayerResearch } from '@/lib/server/players';
import { playerSlugSchema, playerResearchQuerySchema } from '@/lib/schemas';
import { jsonResponse, preflight } from '@/lib/api';
import { isSport } from '@/lib/sports';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ sport: string; slug: string }> },
) {
  const { sport, slug } = await ctx.params;
  if (!isSport(sport)) {
    return jsonResponse({ error: 'Unknown sport' }, { status: 404, request });
  }
  if (!playerSlugSchema.safeParse(slug).success) {
    return jsonResponse({ error: 'Invalid slug' }, { status: 400, request });
  }

  // Validate stat/line consistently with the hitrate route (400 on bad input).
  const parsed = playerResearchQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400, request },
    );
  }

  try {
    const research = await getPlayerResearch(sport, slug, parsed.data.stat, parsed.data.line);
    if (!research) {
      return jsonResponse({ error: 'Player not found' }, { status: 404, request });
    }
    return jsonResponse(research, { request });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
