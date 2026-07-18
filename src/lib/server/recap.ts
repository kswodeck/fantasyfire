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
import type { Sport } from '@/lib/sports';
import type { AccuracyLedger, RecapRow, YesterdayRecap } from '@/lib/types';

/** Max settled rows per day (top leans by pre-game score). */
const RECAP_MAX_ROWS = 9;
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
      // Only settle reads strong enough to have headlined the board.
      if (fs.score < FIREFACTOR_TIER_CUTOFFS.lean) continue;

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
  const tierTotals = (tier: 'Strong lean' | 'Lean') => {
    const rows = days.flatMap((d) => d.rows.filter((r) => r.tier === tier));
    return {
      hits: rows.filter((r) => r.result === 'hit').length,
      misses: rows.filter((r) => r.result === 'miss').length,
      pushes: rows.filter((r) => r.result === 'push').length,
    };
  };
  return {
    days,
    totals: { hits: sum((d) => d.hits), misses: sum((d) => d.misses), pushes: sum((d) => d.pushes) },
    byTier: { strong: tierTotals('Strong lean'), lean: tierTotals('Lean') },
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
    ['accuracy-ledger', sport],
    { revalidate: 21_600, tags: [`recap-${sport}`] },
  );
  return cached().catch(() => null);
}

/**
 * The most recent settled day, for the board/sport-page strip — served from the
 * same cached ledger (no extra compute). Null when the freshest settled day is
 * too old to honestly call "yesterday".
 */
export async function getYesterdayRecap(sport: Sport): Promise<YesterdayRecap | null> {
  const ledger = await getAccuracyLedger(sport);
  const latest = ledger?.days[0];
  if (!latest) return null;
  const ageMs = Date.now() - new Date(`${latest.date}T00:00:00Z`).getTime();
  return ageMs > RECAP_MAX_AGE_DAYS * 86_400_000 ? null : latest;
}
