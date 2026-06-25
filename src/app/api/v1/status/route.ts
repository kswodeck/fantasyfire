// GET /api/v1/status
//
// Ingest health + per-sport data freshness, from the IngestRun audit table. Public
// and read-only — handy for an uptime monitor's keyword check or a status widget.
import type { NextRequest } from 'next/server';
import { getIngestStatus } from '@/lib/server/status';
import { jsonResponse, preflight } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const status = await getIngestStatus();
    return jsonResponse(status, { request });
  } catch {
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
