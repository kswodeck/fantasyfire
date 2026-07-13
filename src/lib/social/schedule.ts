// Pure game-aware scheduling for the social auto-publish pipeline. The workflow
// ticks HOURLY through the posting window; each sport posts at the first tick
// inside its due window — when its first game is within DUE_BEFORE_MIN — instead
// of one fixed time for every sport. Shared by the poster job
// (src/ingest/run-social.ts) and the /api/v1/social/due pre-check route so the
// two can never disagree.
//
// All hours are EASTERN (America/New_York, DST-aware via Intl) — the audience
// clock — never raw UTC, so the window doesn't drift an hour every DST change.

/** No posting outside this ET window: first possible run noon, last 10pm. */
export const WINDOW_START_HOUR_ET = 12;
export const WINDOW_END_HOUR_ET = 22;

/** A sport is due once its first start time is within this many minutes. */
export const DUE_BEFORE_MIN = 120;
/**
 * …and stays due this long AFTER the first start — the catch-up for slates
 * whose first game tips before the window opens (morning MLB, London NFL):
 * they post at the first in-window tick instead of never.
 */
export const DUE_AFTER_MIN = 240;

/** The hour (ET) of the fixed daily slot: sports with no known start time,
 *  the owner content pack, and the push digest all go at the window open. */
export const DAILY_TICK_HOUR_ET = WINDOW_START_HOUR_ET;

/** The hour-of-day in America/New_York for a moment (DST handled by Intl). */
export function etHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(now),
  );
}

/** True inside the ET posting window (noon–10pm inclusive of both tick hours). */
export function isWithinPostingWindow(now: Date): boolean {
  const h = etHour(now);
  return h >= WINDOW_START_HOUR_ET && h <= WINDOW_END_HOUR_ET;
}

/** True during the fixed daily slot's hour (noon ET — the window-open tick). */
export function isDailyTick(now: Date): boolean {
  return etHour(now) === DAILY_TICK_HOUR_ET;
}

/**
 * Should this sport post now? Never outside the posting window. With a known
 * first start, due means "first game within DUE_BEFORE_MIN, or up to
 * DUE_AFTER_MIN past it" — with hourly ticks the first in-window tick posts,
 * and the once-per-day marker stops later ticks from re-posting. Without a
 * start time, fall back to the fixed daily slot.
 */
export function isDueNow(now: Date, firstStart: Date | null): boolean {
  if (!isWithinPostingWindow(now)) return false;
  if (!firstStart) return isDailyTick(now);
  const minutesUntilStart = (firstStart.getTime() - now.getTime()) / 60_000;
  return minutesUntilStart <= DUE_BEFORE_MIN && minutesUntilStart >= -DUE_AFTER_MIN;
}

/**
 * The start time the due window should anchor on: the earliest game that is
 * upcoming or started within the last DUE_AFTER_MIN. The schedule feed buckets
 * days by UTC, so "today's" slate can carry LAST NIGHT's US-evening games
 * (anything after ~8pm ET crosses UTC midnight) — anchoring on the bucket's
 * raw minimum made a sport with a game tonight look 20+ hours stale and never
 * due. Null when every known start is long past (slate effectively over).
 */
export function pickRelevantStart(starts: Date[], now: Date): Date | null {
  const cutoff = now.getTime() - DUE_AFTER_MIN * 60_000;
  const qualifying = starts.map((s) => s.getTime()).filter((t) => t >= cutoff);
  return qualifying.length > 0 ? new Date(Math.min(...qualifying)) : null;
}
