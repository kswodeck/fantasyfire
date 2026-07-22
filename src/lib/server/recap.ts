// The settled-leans ledger — the snapshot-free accuracy engine.
//
// The original /[sport]/accuracy pages ran on a ProjectionSnapshot pipeline
// (nightly snapshot → grade → backtest) that was removed as too costly to
// maintain. This is the replacement, built WITHOUT stored predictions: for each
// recent completed slate day we recompute what the board's top leans WOULD have
// been using only the games played BEFORE that day, then settle each against
// the day's actual box score. Fully deterministic from data we already store —
// no snapshot tables, no extra writes, no grading pipeline to babysit.
//
// Honesty notes (mirrored in the UI captions):
//  - Leans are recomputed at our book-style half-point line (defaultPropLine on
//    the prior games), NOT a book's posted number, and without the matchup /
//    Vegas / pace context (not reconstructable after the fact) — so this is the
//    conservative recent-form read, not a claim about any real bet.
//  - Only Lean-or-stronger reads (score ≥ the Lean cutoff) are settled: the same
//    bar a row must clear to headline the board.
//
// Cost: ONE board-pool load per sport per recompute (players + season game
// logs — the same query class the live board runs), then pure CPU over data
// already in memory; every settled day comes from that single load. Cached via
// unstable_cache for 6 hours — box scores land once nightly, so this computes
// ~4×/day/sport regardless of page traffic (the 15-min board ISR and the
// accuracy page both reuse the same cache entry). Keep this module OUT of the
// ingest import graph: it imports next/cache, which the plain-tsx ingest CLI
// must never load (players.ts stays clean).
import { unstable_cache } from 'next/cache';
import {
  boardStatsFor,
  loadBoardPool,
  opportunityFor,
  qualifyGames,
  type BoardPool,
} from '@/lib/server/players';
import {
  FIREFACTOR_MIN_GAMES,
  FIREFACTOR_TIER_CUTOFFS,
  STAT_DEFS,
  STAT_WINDOWS,
  calibratedLineProbOver,
  computeConsistency,
  computeFireFactor,
  computeHitRate,
  defaultPropLine,
  recentFormEstimate,
  statValue,
  volumeMultiplier,
} from '@/lib/stats';
import { SPORT_LIST, type Sport } from '@/lib/sports';
import { computeBreakdown } from '@/lib/accuracySegments';
import { previousSocialDayIso, socialDayIso } from '@/lib/social/schedule';
import type { AccuracyLedger, RecapRow, YesterdayRecap } from '@/lib/types';

/** Safety cap on stored rows per day. Generous (was 9) so all three strength
 *  segments — including the lowest-scored Slight leans — are represented for the
 *  per-segment records; the ~90-player scan already bounds the real count. */
const RECAP_MAX_ROWS = 60;
/** How many rows the compact "yesterday" board strip shows (the ledger page shows
 *  the rest). */
const STRIP_ROWS = 9;
/** Max strip rows that may share the same stat+side (e.g. "Under 1.5 Hits") — keeps
 *  a day where that combo dominates the pool from filling the whole teaser with it. */
const STRIP_MAX_PER_STAT_SIDE = 2;
/** The freshest day must be at most this old for the strip to say "yesterday". */
const RECAP_MAX_AGE_DAYS = 4;
/** How many completed slate days the full ledger covers. */
export const LEDGER_DAYS = 10;
/** A ledger day can be at most this old — bounds the page in the early season
 *  and keeps "recent form" honest (a month-old settle isn't recent anything). */
const LEDGER_MAX_AGE_DAYS = 21;
/** Pool breadth: matches the home-teaser scan — plenty to fill 9 rows/day. */
const RECAP_SCAN = 90;

/** Settle ONE slate day from an already-loaded pool: recompute each player's
 *  strongest pre-day lean from their prior games, then check the day's box score. */
function settleDay(sport: Sport, pool: BoardPool, day: string): YesterdayRecap | null {
  const candidates: RecapRow[] = [];
  for (const p of pool.players) {
    const all = pool.gamesByPlayer.get(p.id);
    if (!all) continue;
    const settledGame = all.find((g) => g.gameDate === day);
    if (!settledGame) continue;
    // The as-of view: only games strictly before the settled day, qualified with
    // the same role-relative opportunity filter the live board uses.
    const prior = qualifyGames(sport, p.posBucket, all.filter((g) => g.gameDate < day));
    if (prior.length < FIREFACTOR_MIN_GAMES) continue;
    const volumeMult = volumeMultiplier(prior.map((g) => opportunityFor(sport, p.posBucket, g)));

    let best: RecapRow | null = null;
    for (const stat of boardStatsFor(sport, p.posBucket)) {
      const line = defaultPropLine(prior, stat);
      // Same degenerate-line guard as the board: a 0.5 line means the player
      // typically records 0 — any "lean" there is trivial.
      if (line <= 0.5) continue;
      const windows = STAT_WINDOWS.map((w) => {
        const hr = computeHitRate(prior, stat, line, w);
        return { window: String(w), overs: hr.overs, decided: hr.decided };
      });
      const seasonHr = computeHitRate(prior, stat, line, 'season');
      // No opponent/pace/environment factors — pre-game Vegas and DvP context
      // can't be faithfully reconstructed, so the recomputed lean deliberately
      // omits them (computeFireFactor degrades gracefully; see module header).
      const projection = recentFormEstimate(seasonHr.values, seasonHr.mean, {
        volume: volumeMult,
      });
      const modelProbOver = calibratedLineProbOver(
        stat,
        projection.projection,
        projection.adjustment,
        seasonHr.stdev,
        line,
        seasonHr.hitRateOver,
        seasonHr.decided,
      );
      const consistency = computeConsistency(seasonHr.values, seasonHr.mean, seasonHr.stdev, line);
      const fs = computeFireFactor({
        line,
        windows,
        projection: projection.projection,
        stdev: seasonHr.stdev,
        modelProbOver,
        cv: consistency.cv,
        gamesPlayed: prior.length,
      });
      // Settle every real lean — Slight (Warm/Cool) and up — so the accuracy page
      // can break the record down by strength segment (extreme / normal / slight).
      // Below the Slight cutoff is a No-lean / Pass, which carries no directional
      // read worth grading.
      if (fs.score < FIREFACTOR_TIER_CUTOFFS.slight) continue;

      const actual = statValue(stat, settledGame);
      const result: RecapRow['result'] =
        actual > line
          ? fs.side === 'over'
            ? 'hit'
            : 'miss'
          : actual < line
            ? fs.side === 'under'
              ? 'hit'
              : 'miss'
            : 'push';
      const row: RecapRow = {
        sport,
        player: {
          fullName: `${p.firstName} ${p.lastName}`,
          slug: p.slug,
          teamAbbreviation: p.team?.abbreviation ?? null,
        },
        stat,
        statShort: STAT_DEFS[stat].short,
        line,
        side: fs.side,
        score: fs.score,
        tier: fs.tier,
        actual,
        result,
      };
      // One row per player per day (the strongest lean) — variety over volume.
      if (!best || row.score > best.score) best = row;
    }
    if (best) candidates.push(best);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const rows = candidates.slice(0, RECAP_MAX_ROWS);
  return {
    date: day,
    rows,
    hits: rows.filter((r) => r.result === 'hit').length,
    misses: rows.filter((r) => r.result === 'miss').length,
    pushes: rows.filter((r) => r.result === 'push').length,
  };
}

async function computeLedger(sport: Sport): Promise<AccuracyLedger | null> {
  const pool = await loadBoardPool(sport, RECAP_SCAN);

  // Distinct completed slate days present in the pool, newest first (games are
  // most-recent-first per player; gameDate is an ISO YYYY-MM-DD string).
  const daySet = new Set<string>();
  for (const games of pool.gamesByPlayer.values()) {
    for (const g of games) daySet.add(g.gameDate);
  }
  const cutoff = new Date(Date.now() - LEDGER_MAX_AGE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const recentDays = [...daySet].filter((d) => d >= cutoff).sort().reverse().slice(0, LEDGER_DAYS);
  if (recentDays.length === 0) return null;

  const days: YesterdayRecap[] = [];
  for (const day of recentDays) {
    const settled = settleDay(sport, pool, day);
    if (settled) days.push(settled);
  }
  if (days.length === 0) return null;

  const sum = (f: (d: YesterdayRecap) => number) => days.reduce((a, d) => a + f(d), 0);
  const allRows = days.flatMap((d) => d.rows);
  const breakdown = computeBreakdown(allRows);
  return {
    days,
    totals: { hits: sum((d) => d.hits), misses: sum((d) => d.misses), pushes: sum((d) => d.pushes) },
    // byTier kept for back-compat (strong/normal); the richer tier×side split is
    // in `breakdown`, which the accuracy page's filters read.
    byTier: { strong: breakdown.extreme.both, lean: breakdown.normal.both },
    breakdown,
  };
}

/**
 * Cached multi-day settled ledger (see module header). ONE cache entry per
 * sport feeds both the accuracy page and the board strip. 6-hour cache: the
 * inputs only change once a night when box scores land, so page ISR reuses
 * this result instead of re-running the pool scan. Null off-season / when
 * nothing recent settled.
 */
export async function getAccuracyLedger(sport: Sport): Promise<AccuracyLedger | null> {
  const cached = unstable_cache(
    async () => computeLedger(sport),
    // The version segment is part of the cache key: bump it on any change to the
    // cached row shape OR which rows are stored, so stale entries are never read.
    //   v2 — added RecapRow.sport (a v1 entry crashed the all-sports SportTag).
    //   v3 — included Slight leans + the breakdown field (a v2 entry lacks it and
    //        omits slight rows, so the new tier filters would read wrong records).
    ['accuracy-ledger', 'v3', sport],
    { revalidate: 21_600, tags: [`recap-${sport}`] },
  );
  return cached().catch(() => null);
}

/** Greedy diversity cap for a curated top-N teaser (the strip, the all-sports merge)
 *  — NOT for the full per-sport ledger, which stays a plain score sort so it's an
 *  honest, uncurated record. `rows` must already be sorted by score descending.
 *  Walks the list filling `limit` slots, skipping a row once every one of its group
 *  keys has hit that constraint's cap (e.g. one stat+side combo, like "Under 1.5
 *  Hits", can otherwise fill the whole list on a day where it happens to be most
 *  hitters' single strongest read). Anything skipped backfills any slots still open
 *  once the diverse pass runs out, so a genuinely one-note day still shows a full
 *  list instead of coming up short. */
export function pickDiverse(
  rows: readonly RecapRow[],
  limit: number,
  constraints: ReadonlyArray<{ key: (r: RecapRow) => string; max: number }>,
): RecapRow[] {
  const picked: RecapRow[] = [];
  const skipped: RecapRow[] = [];
  const counts = constraints.map(() => new Map<string, number>());
  for (const row of rows) {
    if (picked.length >= limit) break;
    const keys = constraints.map((c) => c.key(row));
    const fits = constraints.every((c, i) => (counts[i].get(keys[i]) ?? 0) < c.max);
    if (fits) {
      picked.push(row);
      constraints.forEach((c, i) => counts[i].set(keys[i], (counts[i].get(keys[i]) ?? 0) + 1));
    } else {
      skipped.push(row);
    }
  }
  for (const row of skipped) {
    if (picked.length >= limit) break;
    picked.push(row);
  }
  return picked;
}

/** Whole calendar days `date` sits behind `today` — both plain YYYY-MM-DD labels
 *  (never a raw ms diff), so this stays a pure day-count regardless of what
 *  wall-clock instant `now` happens to fall on. */
function daysBehind(date: string, today: string): number {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * The most recent settled day, for the board/sport-page strip — served from the
 * same cached ledger (no extra compute). Null when the freshest settled day is
 * too old to show at all.
 *
 * Anchored to the SAME 11pm-ET rollover clock the slate's "Today only" toggle
 * uses (socialDayIso) — previously this compared raw UTC-midnight math against
 * wall-clock Date.now(), so "yesterday" here and "today" on the board flipped
 * at different times each day (drifting apart by however many hours separate
 * UTC midnight from 11pm ET) and could label a 2-day-old settle as "yesterday"
 * during an ingest lag. `isYesterday` lets the UI only say "Yesterday's" when
 * the shown date truly IS the social day before today.
 */
export async function getYesterdayRecap(
  sport: Sport,
  now: Date = new Date(),
): Promise<(YesterdayRecap & { isYesterday: boolean }) | null> {
  const ledger = await getAccuracyLedger(sport);
  const latest = ledger?.days[0];
  if (!latest) return null;
  const today = socialDayIso(now);
  if (daysBehind(latest.date, today) > RECAP_MAX_AGE_DAYS) return null;
  // The strip is a compact teaser (the ledger page shows the full day). Cap how
  // many rows can share the same stat+side so it can't turn into the same lean
  // repeated across the strip, then recompute the record over exactly what's
  // shown, so the strip's "X of Y landed" stays self-consistent.
  const rows = pickDiverse(latest.rows, STRIP_ROWS, [
    { key: (r) => `${r.stat}:${r.side}`, max: STRIP_MAX_PER_STAT_SIDE },
  ]);
  return {
    date: latest.date,
    isYesterday: latest.date === previousSocialDayIso(now),
    rows,
    hits: rows.filter((r) => r.result === 'hit').length,
    misses: rows.filter((r) => r.result === 'miss').length,
    pushes: rows.filter((r) => r.result === 'push').length,
  };
}

/** Max merged rows shown per day on the ALL-SPORTS ledger (top leans across every
 *  sport that settled that date), so a big multi-league slate stays readable. */
const ALL_SPORTS_ROWS_PER_DAY = 12;
/** Max of those 12 that may come from one sport — otherwise a day where one
 *  league's reads simply score higher (or is the only one with a settled slate)
 *  can crowd out every other sport on the "All Sports" page. */
const ALL_SPORTS_MAX_PER_SPORT = 5;
/** Max of those 12 that may share the same sport+stat+side — the cross-sport
 *  version of STRIP_MAX_PER_STAT_SIDE (e.g. a dozen hitters all settling on
 *  "Under 1.5 Hits" shouldn't be able to fill the entire day's list by itself). */
const ALL_SPORTS_MAX_PER_STAT_SIDE = 2;

/**
 * The cross-sport ("All Sports") settled ledger — every in-season sport's cached
 * per-sport ledger merged into combined records and per-DATE rows (each row keeps
 * its own sport, so a mixed day tags/links correctly). Reuses getAccuracyLedger's
 * 6h cache per sport (no new scans), so this is just an in-memory merge over data
 * the sport pages and strips already computed. Null when nothing settled anywhere.
 */
export async function getAllSportsAccuracy(): Promise<AccuracyLedger | null> {
  const ledgers = await Promise.all(
    SPORT_LIST.map(async (sport) => getAccuracyLedger(sport)),
  );
  const present = ledgers.filter((l): l is AccuracyLedger => l !== null);
  if (present.length === 0) return null;

  // Merge every sport's days by DATE — in-season leagues largely share slate days,
  // so a date aggregates all sports that settled it.
  const byDate = new Map<string, RecapRow[]>();
  for (const l of present) {
    for (const d of l.days) {
      const arr = byDate.get(d.date) ?? [];
      arr.push(...d.rows);
      byDate.set(d.date, arr);
    }
  }

  // The breakdown (tier × side records) is computed over EVERY merged row so the
  // filter tiles are authoritative; the per-day list ships a capped, diversity-aware
  // sample for readability (a big multi-league night can be huge, and without the
  // sport/stat+side caps a single dominant read could otherwise fill the whole day).
  // The tiles are the source of truth for the segment records; the day list is
  // recent examples.
  const allMergedRows = [...byDate.values()].flat();
  const breakdown = computeBreakdown(allMergedRows);

  const days: YesterdayRecap[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)) // newest date first
    .map(([date, allRows]) => {
      const sorted = [...allRows].sort((a, b) => b.score - a.score);
      const rows = pickDiverse(sorted, ALL_SPORTS_ROWS_PER_DAY, [
        { key: (r) => r.sport, max: ALL_SPORTS_MAX_PER_SPORT },
        { key: (r) => `${r.sport}:${r.stat}:${r.side}`, max: ALL_SPORTS_MAX_PER_STAT_SIDE },
      ]);
      return {
        date,
        rows,
        hits: rows.filter((r) => r.result === 'hit').length,
        misses: rows.filter((r) => r.result === 'miss').length,
        pushes: rows.filter((r) => r.result === 'push').length,
      };
    });

  return {
    days,
    totals: breakdown.all.both,
    byTier: { strong: breakdown.extreme.both, lean: breakdown.normal.both },
    breakdown,
  };
}
