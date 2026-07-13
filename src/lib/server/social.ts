// Daily-leans selection + game-aware due checks for the social auto-publish
// pipeline (docs/MARKETING.md §3). ONE shared query path so the poster job
// (src/ingest/run-social.ts), the card image route (/api/og/daily/[sport]),
// and the /api/v1/social/due pre-check can never disagree.
import { db } from '@/lib/db';
import { getBoard, getTonightSlate } from '@/lib/server/players';
import { isDueNow } from '@/lib/social/schedule';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

/** One publishable lean — the minimal, display-ready slice of a BoardRow. */
export interface DailyLean {
  slug: string;
  firstName: string;
  lastName: string;
  teamAbbreviation: string | null;
  statShort: string;
  line: number;
  side: 'over' | 'under';
  /** Only lean tiers are publishable — never "Slight lean" or below. */
  tier: 'Strong lean' | 'Lean';
}

const PUBLISHABLE_TIERS: ReadonlySet<string> = new Set(['Strong lean', 'Lean']);

/**
 * Today's strongest publishable leans for a sport, or [] when the sport has no
 * slate TODAY (off-season, or its next slate is days out — same gate as the home
 * page). Filtered to players whose team is actually on today's slate, capped to
 * one lean per player for variety, ranked by the board's FireFactor order.
 */
export async function getDailyLeans(sport: Sport, limit = 5): Promise<DailyLean[]> {
  const slate = await getTonightSlate(sport).catch(() => ({
    date: null as string | null,
    games: [],
  }));
  const todayIso = new Date().toISOString().slice(0, 10);
  if (slate.date !== todayIso || slate.games.length === 0) return [];

  const teams = new Set(
    slate.games
      .flatMap((g) => [g.home.abbr, g.away.abbr])
      .filter((a): a is string => !!a),
  );

  const rows = await getBoard(sport, { limit: 40 }).catch(() => [] as BoardRow[]);
  const seen = new Set<string>();
  const leans: DailyLean[] = [];
  for (const r of rows) {
    if (!PUBLISHABLE_TIERS.has(r.fireScore.tier)) continue;
    const abbr = r.player.teamAbbreviation ?? null;
    if (teams.size > 0 && (!abbr || !teams.has(abbr))) continue;
    if (seen.has(r.player.slug)) continue;
    seen.add(r.player.slug);
    leans.push({
      slug: r.player.slug,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      teamAbbreviation: abbr,
      statShort: r.statShort,
      line: r.line,
      side: r.fireScore.side,
      tier: r.fireScore.tier as DailyLean['tier'],
    });
    if (leans.length >= limit) break;
  }
  return leans;
}

/**
 * TODAY's slate timing for a sport: whether a slate exists today, and the
 * earliest known start time (null when the feed carries no start times).
 * Drives the "post ~an hour before the first game" window
 * (src/lib/social/schedule.ts).
 */
export async function getTodaySlateTiming(
  sport: Sport,
): Promise<{ hasSlateToday: boolean; firstStart: Date | null }> {
  const slate = await getTonightSlate(sport).catch(() => ({
    date: null as string | null,
    games: [] as { startTime: string | null }[],
  }));
  const todayIso = new Date().toISOString().slice(0, 10);
  if (slate.date !== todayIso || slate.games.length === 0) {
    return { hasSlateToday: false, firstStart: null };
  }
  const starts = slate.games
    .map((g) => (g.startTime ? new Date(g.startTime).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  return {
    hasSlateToday: true,
    firstStart: starts.length > 0 ? new Date(Math.min(...starts)) : null,
  };
}

/**
 * Has a successful social publish already been recorded today (UTC)? Markers
 * live in the existing IngestRun audit table under `social:{sport}` (and
 * `social:pack` for the owner briefing) — no new schema.
 */
export async function socialPostedToday(job: string): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const row = await db.ingestRun.findFirst({
    where: { job, status: 'success', startedAt: { gte: dayStart } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Is this sport due to post right now? Requires a slate TODAY, then true
 * inside the pre-game window of its first game (fallback: the fixed daily
 * slot when the feed has no start times), and false once today's marker
 * exists. Lean availability stays with the caller — this is purely the
 * slate/timing/already-posted check.
 */
export async function isSportDue(sport: Sport, now = new Date()): Promise<boolean> {
  if (await socialPostedToday(`social:${sport}`)) return false;
  const { hasSlateToday, firstStart } = await getTodaySlateTiming(sport);
  if (!hasSlateToday) return false;
  return isDueNow(now, firstStart);
}
