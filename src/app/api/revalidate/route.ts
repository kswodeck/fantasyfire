// POST /api/revalidate
//
// On-demand ISR revalidation for the pages whose data actually changed, called by
// the ingest pipeline (running on GitHub Actions) after it writes new lines. This
// is the "only regenerate when something changed" lever: instead of every page
// regenerating on a timer (and re-emitting identical HTML — the ISR Writes that blew
// past the Vercel limit), only the exact player/stat paths that moved get rebuilt.
//
// Secured by a shared secret (REVALIDATE_SECRET). If the secret is unset the route
// is disabled (503) so a misconfigured deploy can't be poked, and the ingest's
// caller treats that as a no-op. Server-to-server only — no CORS.
import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Only internal, app-relative paths built from our own slugs: a leading slash then
// alnum / hyphen segments (e.g. /nba/lebron-james or /nfl/josh-allen/passYds — NFL
// stat keys are camelCase, so uppercase is allowed). Rejects protocol-relative
// (`//host`), traversal (`..`), and anything exotic.
const PATH_RE = /^\/[A-Za-z0-9]+(?:\/[A-Za-z0-9-]+){0,3}$/;

const bodySchema = z.object({
  paths: z.array(z.string().regex(PATH_RE)).min(1).max(5000),
});

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // Feature off: nothing to leak, and the ingest treats this as a skip.
    return Response.json({ error: 'revalidation disabled' }, { status: 503 });
  }
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'invalid paths' }, { status: 400 });
  }

  const paths = [...new Set(parsed.data.paths)];
  for (const path of paths) revalidatePath(path);

  return Response.json({ revalidated: paths.length });
}
