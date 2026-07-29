// Typical season windows per sport — the calendar gate the ingests run behind.
//
// WHY: an off-season pull is pure waste. It burns an Actions run and a DB
// connection to fetch a scoreboard that has nothing on it, and the upstream feeds
// routinely 500 on off-season dates, so the job fails noisily for a non-problem.
// Gating on the calendar means the summer NBA/NHL/CBB runs simply don't happen.
//
// These are TYPICAL windows, not the exact league calendar — they only need to be
// wide enough never to miss real games. Each runs from roughly the regular-season
// opening to after the POSTSEASON ends (playoffs / bowls / finals included), and
// GRACE_DAYS of slack is added on both ends, so an early start or a long
// postseason still lands inside. Verify against the league calendar if a season
// ever shifts materially (docs/PLAN.md §11 — this space changes).
//
// (season.ts is the NBA's season-STRING resolution — a different question.)
import type { Sport } from '@/lib/sports';

/** Slack on both ends of every window — the "within 30 days" rule. */
export const GRACE_DAYS = 30;

interface SeasonWindow {
  /** Regular-season opening, roughly. [month (1-12), day] */
  start: [month: number, day: number];
  /** After the postseason ends (Finals / World Series / Super Bowl / title game). */
  end: [month: number, day: number];
  /** True when `end` falls in the calendar year AFTER `start` (NFL, NHL, …). */
  wrapsYear: boolean;
}

/**
 * Start → end (postseason included) per sport. Kept in ONE place so the ingest
 * gate — and anything else asking "is this sport plausibly playing" — agree.
 */
export const SEASON_WINDOWS: Record<Sport, SeasonWindow> = {
  // Tip-off mid-October; the Finals end in late June.
  nba: { start: [10, 1], end: [6, 30], wrapsYear: true },
  // Opening Day late March; the World Series ends in early November.
  mlb: { start: [3, 15], end: [11, 10], wrapsYear: false },
  // Preseason in August, Week 1 in September; the Super Bowl is mid-February.
  nfl: { start: [8, 1], end: [2, 20], wrapsYear: true },
  // Opening night early October; the Stanley Cup wraps in late June.
  nhl: { start: [10, 1], end: [6, 30], wrapsYear: true },
  // Tip-off mid-May; the Finals wrap in mid-to-late October.
  wnba: { start: [5, 1], end: [10, 31], wrapsYear: false },
  // Kickoff late February; MLS Cup is in early December.
  mls: { start: [2, 15], end: [12, 10], wrapsYear: false },
  // Week 0 in late August; the CFP title game is mid-January.
  cfb: { start: [8, 20], end: [1, 25], wrapsYear: true },
  // Tip-off early November; the national title game is early April.
  cbb: { start: [11, 1], end: [4, 10], wrapsYear: true },
};

const DAY_MS = 86_400_000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/**
 * Is `now` inside the sport's season window, widened by `graceDays` on each end?
 *
 * True when the date sits between start and end, OR within the grace of either
 * edge — so the ingest is already running before opening night and keeps running
 * through the postseason tail. Anchors the window to each nearby year so a
 * wrapping season (NFL: August → February) matches on both sides of New Year.
 */
export function isInSeasonWindow(
  sport: Sport,
  now: Date = new Date(),
  graceDays: number = GRACE_DAYS,
): boolean {
  const w = SEASON_WINDOWS[sport];
  if (!w) return true; // unknown sport: never gate it off
  const t = now.getTime();
  const grace = graceDays * DAY_MS;
  const year = now.getUTCFullYear();
  // A wrapping window anchored to LAST year can still cover today (Jan 5 belongs
  // to the season that opened last August), hence the -1 / 0 / +1 sweep.
  for (const anchor of [year - 1, year, year + 1]) {
    const start = utc(anchor, w.start[0], w.start[1]) - grace;
    const end = utc(anchor + (w.wrapsYear ? 1 : 0), w.end[0], w.end[1]) + grace;
    if (t >= start && t <= end) return true;
  }
  return false;
}

/**
 * The gate the ingest runners actually call. `isInSeasonWindow`, plus the one
 * escape hatch: INGEST_IGNORE_SEASON=true forces the pull through (backfills,
 * a league that moved its calendar, a manual re-run mid-summer).
 */
export function shouldIngest(sport: Sport, now: Date = new Date()): boolean {
  if (process.env.INGEST_IGNORE_SEASON === 'true') return true;
  return isInSeasonWindow(sport, now);
}

/** Human-readable reason for a skipped ingest (logged by the runners). */
export function offSeasonReason(sport: Sport, now: Date = new Date()): string {
  const w = SEASON_WINDOWS[sport];
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = ([m, d]: [number, number]) => `${pad(m)}-${pad(d)}`;
  return (
    `${sport.toUpperCase()} is out of season on ${now.toISOString().slice(0, 10)} ` +
    `— window ${fmt(w.start)} → ${fmt(w.end)}${w.wrapsYear ? ' (next year)' : ''}, ` +
    `±${GRACE_DAYS}d grace. Skipping the pull.`
  );
}
