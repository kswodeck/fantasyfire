// GET /api/v1/social/due — the social workflow's cheap hourly pre-check
// (docs/MARKETING.md §3): which sports are inside their pre-game posting
// window right now? The GitHub Actions "check" job curls this (~seconds) and
// skips the full pnpm-install publish job on idle hours — the repo is private,
// so Actions minutes are billed. Same isSportDue logic the poster itself runs;
// schedule data only (no lean computation — that stays in the heavy job).
import type { NextRequest } from 'next/server';
import { isSportDue, socialPostedToday } from '@/lib/server/social';
import { isDailyTick } from '@/lib/social/schedule';
import { jsonResponse, preflight } from '@/lib/api';
import { SPORT_LIST } from '@/lib/sports';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const due = (
      await Promise.all(SPORT_LIST.map(async (s) => ((await isSportDue(s, now)) ? s : null)))
    ).filter((s): s is (typeof SPORT_LIST)[number] => s !== null);
    // The fixed daily slot also wakes the job for the owner content pack (and
    // the no-start-time fallback), once per day.
    const dailyTick = isDailyTick(now) && !(await socialPostedToday('social:pack', now));
    return jsonResponse({ anyDue: due.length > 0 || dailyTick, due, dailyTick }, { request });
  } catch {
    // Fail open — the workflow treats an error as "run the full job".
    return jsonResponse({ error: 'Service unavailable' }, { status: 503, request });
  }
}
