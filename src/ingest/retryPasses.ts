// Slow-pass retry for the ESPN ingest, split out of run-ingest-espn.ts so it can be
// unit-tested — that module kicks off `recordIngestRun(...)` at import time, so a test
// can never load it.
//
// The shape: a fast burst pass runs in the caller (pMap), whatever failed is handed
// here, and this grinds through it in a few slow sequential passes — a pause before
// each pass, a small gap between items — dropping items as they succeed. Whatever is
// still failing at the end goes back to the CALLER, which decides whether that is
// fatal (an in-season scoreboard date: skipping it would leave a permanent hole in the
// history) or skippable (a box-score summary).
//
// WHY THE OUTAGE SHORT-CIRCUIT EXISTS. This retried every failed item on every pass,
// unconditionally, and that is fine for a handful of flaky dates but catastrophic when
// the source itself is down. On 2026-08-12 the CFB walk covered ~350 dates, ESPN
// refused all of them, and the retry ground through 350 items x 3 passes at ~2.5s each
// before failing anyway: 46m42s of a 51m job, on a private repo where every one of
// those minutes is billed. It was not an isolated day — eight consecutive daily runs
// (Aug 5-12) burned 47-51 minutes each in the same loop, roughly 400 billed minutes,
// and not one of them was rescued by the retries. A wall of consecutive failures
// across a large set is an outage or a block, and no amount of grinding fixes it.
//
// The trade this accepts: a genuine source blip that would have cleared within a pass
// or two now waits for the next scheduled run instead of self-healing in place. That
// is the design's existing fallback anyway — in-season dates abort loudly so the next
// run retries them — and it only applies to a large set where NOTHING is getting
// through. Intermittent success resets the streak and the full retry behaviour is
// unchanged.

/** Slow passes over the failures left by the fast burst pass. */
export const RETRY_PASSES = 3;
/** Pause before pass N is N x this (30s, 60s, 90s). */
export const RETRY_PASS_BASE_MS = 30_000;
/** Gap between individual items inside a pass — deliberate politeness to the source. */
export const RETRY_ITEM_GAP_MS = 500;

/**
 * Below this many pending items the full grind is cheap, so it runs untouched; the
 * short-circuit is about sets big enough for the retry itself to cost real money.
 */
export const SYSTEMIC_MIN_ITEMS = 25;
/**
 * Consecutive failures inside one pass that mark the source as down rather than flaky.
 * Ten in a row against a live source is implausible; against a 403/500 wall it is the
 * first ten items.
 */
export const SYSTEMIC_FAILURE_STREAK = 10;

/** Overridable timings — tests pass zeros so they don't actually sleep for minutes. */
export interface RetryTimings {
  passes?: number;
  passBaseMs?: number;
  itemGapMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

/**
 * Run `attempt` over `items` in slow sequential passes, dropping items as they
 * succeed. Returns whatever still fails after every pass — including anything left
 * untried when the outage short-circuit fires, so the caller's fatal/skippable
 * decision sees the complete set either way.
 */
export async function retryInPasses<T>(
  label: string,
  items: T[],
  attempt: (item: T) => Promise<void>,
  describe: (item: T) => string,
  timings: RetryTimings = {},
): Promise<T[]> {
  const passes = timings.passes ?? RETRY_PASSES;
  const passBaseMs = timings.passBaseMs ?? RETRY_PASS_BASE_MS;
  const itemGapMs = timings.itemGapMs ?? RETRY_ITEM_GAP_MS;

  let pending = items;
  for (let pass = 1; pass <= passes && pending.length > 0; pass++) {
    const waitMs = passBaseMs * pass;
    console.warn(
      `${label} retry pass ${pass}/${passes} for ${pending.length} item(s) after ${Math.round(waitMs / 1000)}s pause`,
    );
    await sleep(waitMs);

    const still: T[] = [];
    let streak = 0;
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      try {
        await attempt(item);
        streak = 0;
      } catch (e) {
        console.warn(`${label} ${describe(item)} failed (pass ${pass}): ${(e as Error).message}`);
        still.push(item);
        streak++;
      }

      // Outage short-circuit — see the header note.
      if (streak >= SYSTEMIC_FAILURE_STREAK && pending.length >= SYSTEMIC_MIN_ITEMS) {
        const untried = pending.length - i - 1;
        console.warn(
          `${label} ${streak} consecutive failures across ${pending.length} pending item(s) — ` +
            `treating this as a source outage and abandoning ${untried} untried retr${untried === 1 ? 'y' : 'ies'} ` +
            `plus ${passes - pass} remaining pass(es). The caller still decides what is fatal.`,
        );
        for (let j = i + 1; j < pending.length; j++) still.push(pending[j]);
        return still;
      }

      await sleep(itemGapMs);
    }
    pending = still;
  }
  return pending;
}
