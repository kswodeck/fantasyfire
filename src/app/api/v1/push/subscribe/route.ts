// POST   /api/v1/push/subscribe  — save/refresh a Web Push subscription
// DELETE /api/v1/push/subscribe  — remove one (by endpoint)
//
// The subscription endpoint is the identity (no account). Same-origin only in
// practice; CORS is handled by the shared helper.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { jsonResponse, preflight } from '@/lib/api';

export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  sports: z.array(z.string()).max(5).optional(),
});

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400, request });
  }
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: 'Invalid subscription' }, { status: 400, request });
  }
  const { endpoint, keys, sports } = parsed.data;
  const sportsCsv = sports?.length ? sports.join(',') : null;
  try {
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, sports: sportsCsv },
      update: { p256dh: keys.p256dh, auth: keys.auth, sports: sportsCsv },
    });
    return jsonResponse({ ok: true }, { request });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}

export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400, request });
  }
  const endpoint =
    body && typeof body === 'object' && typeof (body as { endpoint?: unknown }).endpoint === 'string'
      ? (body as { endpoint: string }).endpoint
      : null;
  if (!endpoint) {
    return jsonResponse({ error: 'Missing endpoint' }, { status: 400, request });
  }
  try {
    await db.pushSubscription.deleteMany({ where: { endpoint } });
    return jsonResponse({ ok: true }, { request });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
