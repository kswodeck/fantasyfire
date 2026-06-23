// GET /api/v1/players?q=&limit=
//
// Player search/list for the website's search box and any future client.
import type { NextRequest } from 'next/server';
import { playersQuerySchema } from '@/lib/schemas';
import { searchPlayers } from '@/lib/server/players';
import { jsonResponse, preflight } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
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
    const players = await searchPlayers(q, limit);
    return jsonResponse({ players }, { request });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
