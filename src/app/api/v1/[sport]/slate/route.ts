// POST /api/v1/{sport}/slate
//
// Body: { text: string } — the user's pasted prop lines. Returns analyzed
// results (FireFactor vs the user's REAL line, plus edge/EV when odds are given).
// Dynamic + same-origin (the board page calls it); no caching.
import type { NextRequest } from 'next/server';
import { slateBodySchema } from '@/lib/schemas';
import { analyzeSlate } from '@/lib/server/players';
import { jsonResponse, preflight } from '@/lib/api';
import { isSport } from '@/lib/sports';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) {
    return jsonResponse({ error: 'Unknown sport' }, { status: 404, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400, request });
  }

  const parsed = slateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Invalid body', issues: parsed.error.flatten() },
      { status: 400, request },
    );
  }

  try {
    const results = await analyzeSlate(sport, parsed.data.text);
    return jsonResponse({ results }, { request });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
