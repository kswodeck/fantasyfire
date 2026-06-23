// GET /api/v1/hitrate?playerSlug=&stat=&line=
//
// Versioned JSON API — the canonical data source for the website's interactive
// line/stat switcher AND any future mobile client (PLAN §3b). Returns the full
// research payload (hit rates + Wilson confidence per window, chart, DvP, the
// auto "why"). `line` is optional; omitted => the stat's season average to 0.5.
//
// Adding an auth check later is a one-line change here (PLAN §1 auth note).
import type { NextRequest } from 'next/server';
import { hitRateQuerySchema } from '@/lib/schemas';
import { getPlayerResearch } from '@/lib/server/players';
import { jsonResponse, preflight } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = hitRateQuerySchema.safeParse(params);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400, request },
    );
  }

  const { playerSlug, stat, line } = parsed.data;
  try {
    const research = await getPlayerResearch(playerSlug, stat, line);
    if (!research) {
      return jsonResponse({ error: 'Player not found' }, { status: 404, request });
    }
    return jsonResponse(research, { request });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
