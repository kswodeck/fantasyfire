// Pure game-aware scheduling for the social auto-publish pipeline. The workflow
// ticks HOURLY through the game-day window; each sport posts at the first tick
// inside its due window — ~an hour before its first game — instead of one fixed
// time for every sport. Shared by the poster job (src/ingest/run-social.ts) and
// the /api/v1/social/due pre-check route so the two can never disagree.

/** A sport is due from this many minutes BEFORE its first start time… */
export const DUE_BEFORE_MIN = 75;
/** …until this many minutes AFTER it (catch-up for cron jitter / late runs). */
export const DUE_AFTER_MIN = 60;
/**
 * The fixed daily slot (UTC hour): sports with no known start time post here,
 * and the owner content pack + push digest always go here.
 */
export const DAILY_TICK_UTC_HOUR = 15;

/** True when `now` falls in the fixed daily slot's hour. */
export function isDailyTick(now: Date): boolean {
  return now.getUTCHours() === DAILY_TICK_UTC_HOUR;
}

/**
 * Should this sport post now? With a known first start, due means "inside the
 * [start − DUE_BEFORE_MIN, start + DUE_AFTER_MIN] window" — with hourly ticks,
 * the first tick in that window posts 15–75 minutes before the game (the
 * once-per-day marker stops later ticks from re-posting). Without a start
 * time, fall back to the fixed daily slot.
 */
export function isDueNow(now: Date, firstStart: Date | null): boolean {
  if (!firstStart) return isDailyTick(now);
  const minutesUntilStart = (firstStart.getTime() - now.getTime()) / 60_000;
  return minutesUntilStart <= DUE_BEFORE_MIN && minutesUntilStart >= -DUE_AFTER_MIN;
}
