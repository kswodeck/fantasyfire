// Daily-leans selection + game-aware due checks for the social auto-publish
// pipeline (docs/MARKETING.md §3). ONE shared query path so the poster job
// (src/ingest/run-social.ts), the card image route (/api/og/daily/[sport]),
// and the /api/v1/social/due pre-check can never disagree.
import { db } from '@/lib/db';
import { getBoard, getSourcedBoards, getTonightSlate, getTrendBoard } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { isDueNow, pickRelevantStart, socialDayStart, socialDayWindow } from '@/lib/social/schedule';
import { SPORTS, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

/** One publishable lean — the minimal, display-ready slice of a BoardRow. */
export interface DailyLean {
  slug: string;
  firstName: string;
  lastName: string;
  /** League person id (PlayerSummary.externalId) — drives the official
   *  headshot on the card images; optional so composed-text fixtures skip it. */
  playerExternalId?: number;
  teamAbbreviation: string | null;
  statShort: string;
  line: number;
  side: 'over' | 'under';
  /** Only lean tiers are publishable — never "Slight lean" or below. */
  tier: 'Strong lean' | 'Lean';
  /** Book source id the line came from (providedSources.ts), null = our computed median. */
  linesSource?: string | null;
}

const PUBLISHABLE_TIERS: ReadonlySet<string> = new Set(['Strong lean', 'Lean']);

/**
 * The board rows the social pipeline publishes from — the SAME preference the
 * site's board page uses: a real book's lines when the provided-lines feature
 * is on and a book has today's slate (first available source, PrizePicks-
 * ordered; override with SOCIAL_LINES_SOURCE), else the computed median board.
 * Real book lines are the familiar *.5 numbers; the computed fallback can land
 * on whole numbers.
 */
async function getSocialBoardRows(
  sport: Sport,
): Promise<{ rows: BoardRow[]; source: string | null }> {
  const sources = await getAvailableSources(sport).catch(() => [] as string[]);
  const preferred = process.env.SOCIAL_LINES_SOURCE?.trim().toLowerCase();
  const source = preferred && sources.includes(preferred) ? preferred : sources[0];
  if (source) {
    const boards = await getSourcedBoards(sport, [source], { limit: 40 }).catch(
      () => ({}) as Record<string, BoardRow[]>,
    );
    const rows = boards[source] ?? [];
    if (rows.length > 0) return { rows, source };
  }
  return { rows: await getBoard(sport, { limit: 40 }).catch(() => [] as BoardRow[]), source: null };
}

/**
 * Today's strongest publishable leans for a sport, or [] when the sport has no
 * slate TODAY (off-season, or its next slate is days out — same gate as the home
 * page). Filtered to players whose team is actually on today's slate, capped to
 * one lean per player for variety, ranked by the board's FireFactor order.
 */
export async function getDailyLeans(
  sport: Sport,
  limit = 5,
  now = new Date(),
): Promise<DailyLean[]> {
  const { hasSlate, teams } = await getSocialSlate(sport, now);
  if (!hasSlate) return [];

  const { rows, source } = await getSocialBoardRows(sport);
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
      playerExternalId: r.player.externalId,
      teamAbbreviation: abbr,
      statShort: r.statShort,
      line: r.line,
      side: r.fireScore.side,
      tier: r.fireScore.tier as DailyLean['tier'],
      linesSource: source,
    });
    if (leans.length >= limit) break;
  }
  return leans;
}

/**
 * The sport's slate for the SOCIAL day containing `now` — the 11pm-ET-to-11pm-ET
 * window (schedule.ts), NOT the feed's UTC-day buckets (those roll at 8pm ET
 * and split US evenings across two "days"). Primary path: games whose actual
 * startTime falls inside the window. Fallback for feeds that omit start times:
 * the legacy UTC bucket via getTonightSlate.
 */
async function getSocialSlate(
  sport: Sport,
  now: Date,
): Promise<{ hasSlate: boolean; hasKnownStarts: boolean; starts: Date[]; teams: Set<string> }> {
  const { start, end } = socialDayWindow(now);
  const rows = await db.scheduledGame
    .findMany({
      where: { sport, startTime: { gte: start, lt: end } },
      include: {
        homeTeam: { select: { abbreviation: true } },
        awayTeam: { select: { abbreviation: true } },
      },
    })
    .catch(() => []);
  if (rows.length > 0) {
    // Content covers games still UPCOMING — once a game tips its props are
    // dead, so an in-progress matinee's players don't belong on a card posted
    // ahead of the evening tip. A started game's teams only count when nothing
    // is still upcoming (the morning-only-slate catch-up), mirroring
    // pickRelevantStart's anchor preference.
    const upcoming = rows.filter((r) => (r.startTime as Date).getTime() >= now.getTime());
    const relevant = upcoming.length > 0 ? upcoming : rows;
    const teams = new Set(
      relevant
        .flatMap((r) => [r.homeTeam.abbreviation, r.awayTeam.abbreviation])
        .filter((a): a is string => !!a),
    );
    return {
      hasSlate: true,
      hasKnownStarts: true,
      starts: rows.map((r) => r.startTime as Date),
      teams,
    };
  }

  // No timed games in the window — a feed without start times still deserves
  // the daily-slot fallback. Legacy UTC-bucket check, untimed games only.
  const slate = await getTonightSlate(sport).catch(() => ({
    date: null as string | null,
    games: [] as { startTime: string | null; home: { abbr: string | null }; away: { abbr: string | null } }[],
  }));
  const todayIso = now.toISOString().slice(0, 10);
  const untimed = slate.games.filter((g) => !g.startTime);
  if (slate.date !== todayIso || untimed.length === 0) {
    return { hasSlate: false, hasKnownStarts: false, starts: [], teams: new Set() };
  }
  const teams = new Set(
    untimed.flatMap((g) => [g.home.abbr, g.away.abbr]).filter((a): a is string => !!a),
  );
  return { hasSlate: true, hasKnownStarts: false, starts: [], teams };
}

/**
 * TODAY's slate timing for a sport (11pm-ET day): whether a slate exists,
 * whether the feed carries start times at all, and the start the due window
 * should anchor on — the earliest UPCOMING (or just-started) game. Drives the
 * pre-game posting window (src/lib/social/schedule.ts).
 */
export async function getTodaySlateTiming(
  sport: Sport,
  now = new Date(),
): Promise<{ hasSlateToday: boolean; hasKnownStarts: boolean; firstStart: Date | null }> {
  const { hasSlate, hasKnownStarts, starts } = await getSocialSlate(sport, now);
  return {
    hasSlateToday: hasSlate,
    hasKnownStarts,
    firstStart: pickRelevantStart(starts, now),
  };
}

/**
 * The longest active streaks across the given sports — the Sunday recap's
 * data. Best streak per player from each sport's trend board, merged and
 * ranked by length. Descriptive facts only (a streak is history).
 */
export async function getWeeklyStreaks(
  sports: Sport[],
  limit = 5,
): Promise<
  {
    sportName: string;
    firstName: string;
    lastName: string;
    statShort: string;
    line: number;
    side: 'over' | 'under';
    length: number;
  }[]
> {
  const all: Awaited<ReturnType<typeof getWeeklyStreaks>> = [];
  for (const sport of sports) {
    const rows = await getTrendBoard(sport, { limit: 40 }).catch(() => []);
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.streak || r.streak.length < 4) continue;
      if (seen.has(r.player.slug)) continue;
      seen.add(r.player.slug);
      all.push({
        sportName: SPORTS[sport].name,
        firstName: r.player.firstName,
        lastName: r.player.lastName,
        statShort: r.statShort,
        line: r.line,
        side: r.streak.side,
        length: r.streak.length,
      });
    }
  }
  return all.sort((a, b) => b.length - a.length).slice(0, limit);
}

/**
 * Has a successful social publish already been recorded this SOCIAL day (the
 * 11pm-ET-to-11pm-ET window — matching the slate definition, so the marker
 * can't reset mid-evening like the old UTC-midnight check, which rolled at
 * 8pm ET)? Markers live in the existing IngestRun audit table under
 * `social:{sport}` (and `social:pack` / `social:digest`) — no new schema.
 */
export async function socialPostedToday(job: string, now = new Date()): Promise<boolean> {
  const row = await db.ingestRun.findFirst({
    where: { job, status: 'success', startedAt: { gte: socialDayStart(now) } },
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
  if (await socialPostedToday(`social:${sport}`, now)) return false;
  const { hasSlateToday, hasKnownStarts, firstStart } = await getTodaySlateTiming(sport, now);
  if (!hasSlateToday) return false;
  // Start times exist but every game is long past → the slate is over; don't
  // fall back to the daily slot for a finished day.
  if (hasKnownStarts && !firstStart) return false;
  return isDueNow(now, firstStart);
}
