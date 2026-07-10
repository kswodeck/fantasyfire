// GET /api/v1/{sport}/hitrate?playerSlug=&stat=&line=
//
// Versioned JSON API — the canonical data source for the website's interactive
// line/stat switcher AND any future mobile client. Returns the full research
// payload (hit rates + Wilson confidence per window, chart, matchup, the auto
// "why"). `line` is optional; omitted => the stat's season average to 0.5.
import type { NextRequest } from 'next/server';
import { hitRateQuerySchema } from '@/lib/schemas';
import { getPlayerResearch } from '@/lib/server/players';
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
  const parsed = hitRateQuerySchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400, request },
    );
  }

  const { playerSlug, stat, line, source, oddsType, multiplier } = parsed.data;
  try {
    const research = await getPlayerResearch(
      sport,
      playerSlug,
      stat,
      line,
      source,
      oddsType != null || multiplier != null ? { oddsType, multiplier } : undefined,
    );
    if (!research) {
      return jsonResponse({ error: 'Player not found' }, { status: 404, request });
    }
    return jsonResponse(research, { request, cacheSeconds: 60 });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
