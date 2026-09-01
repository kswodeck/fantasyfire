// GET /api/v1/geo
//
// The reader's coarse location — country + region (US state) — so the client can
// suppress a book link in a state where that book doesn't offer the over/under prop
// product (see lib/bookAvailability.ts).
//
// WHY THIS IS A ROUTE HANDLER AND NOT A SERVER-COMPONENT READ:
// touching request headers is a request-time API, which opts the calling route into
// dynamic rendering. Every page that carries a book link — player pages above all —
// is statically generated and revalidated, and that ISR/static surface IS the SEO
// moat. Reading geo inside those pages would turn the whole thing dynamic to
// personalise one link. Isolating it in its own uncached handler, fetched from the
// client after hydration, keeps the pages exactly as static as they are today.
//
// Privacy posture: returns nothing finer than a state, echoes headers the edge
// already attached, stores nothing, and logs nothing. Cache-Control is
// `private, no-store` because the answer differs per reader — a shared cache hit
// here would hand one reader's region to another.
import type { NextRequest } from 'next/server';
import { corsHeaders, preflight } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  const headers = request.headers;

  // Set by Vercel's edge network. Absent in local dev and on any other host, in
  // which case both fields are null and the client falls back to showing the link.
  const country = headers.get('x-vercel-ip-country');
  const region = headers.get('x-vercel-ip-country-region');

  return Response.json(
    { country: country || null, region: region || null },
    {
      headers: {
        ...corsHeaders(headers.get('origin')),
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
