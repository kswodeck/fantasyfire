// Shared helpers for /api/v1 route handlers: JSON responses + CORS.
//
// CORS is scoped to known origins (PLAN §3b #9), NOT "*". The website calls the
// API same-origin (no CORS needed); explicit origins keep the door open for a
// future Capacitor/native client without opening it to everyone. Add origins via
// the API_ALLOWED_ORIGINS env (comma-separated).
import { SITE } from '@/lib/site';

const extraOrigins = (process.env.API_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set<string>([
  SITE.url,
  'http://localhost:3000',
  // Common Capacitor origins, ready for a future native shell:
  'capacitor://localhost',
  'http://localhost',
  ...extraOrigins,
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
  return {};
}

/** JSON response with CORS headers derived from the request's Origin. */
export function jsonResponse(
  data: unknown,
  opts: { status?: number; request: Request },
): Response {
  const origin = opts.request.headers.get('origin');
  return Response.json(data, {
    status: opts.status ?? 200,
    headers: corsHeaders(origin),
  });
}

/** Standard 204 preflight response. */
export function preflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}
