// "Yesterday's leans, settled" — the snapshot-free honesty loop.
//
// The public /[sport]/accuracy track record was removed on purpose (a moving
// target too costly to maintain). This is the lightweight replacement: for the
// most recent COMPLETED slate day we recompute what the board's top leans WOULD
// have been using only the games played BEFORE that day, then settle each one
// against the day's actual box score. Fully deterministic from data we already
// store — no snapshot tables, no extra writes, no grading pipeline.
//
// Honesty notes (mirrored in the UI caption):
//  - Leans are recomputed at our book-style half-point line (defaultPropLine on
//    the prior games), NOT a book's posted number, and without the matchup /
//    Vegas / pace context (not reconstructable after the fact) — so this is the
//    conservative recent-form read, not a claim about any real bet.
//  - Only Lean-or-stronger reads (score ≥ the Lean cutoff) are settled: the same
//    bar a row must clear to headline the board.
//
// Cost: one board-pool load per sport per revalidation, cached via
// unstable_cache for 6 hours — box scores land once nightly, so this computes
// ~4×/day/sport regardless of page traffic (the 15-min board ISR never re-runs
// it). Keep this module OUT of the ingest import graph: it imports next/cache,
// which the plain-tsx ingest CLI must never load (players.ts stays clean).
import { unstable_cache } from 'next/cache';
import {
  boardStatsFor,
  loadBoardPool,
  opportunityFor,
  qualifyGames,
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
import type { RecapRow, YesterdayRecap } from '@/lib/types';

/** Max settled rows shown (top leans by pre-game score). */
const RECAP_MAX_ROWS = 9;
/** Don't show a recap older than this — a week-old slate isn't "yesterday". */
const RECAP_MAX_AGE_DAYS = 4;
/** Pool breadth: matches the home-teaser scan — plenty to fill 9 rows. */
const RECAP_SCAN = 90;

async function computeYesterdayRecap(sport: Sport): Promise<YesterdayRecap | null> {
  const { players, gamesByPlayer } = await loadBoardPool(sport, RECAP_SCAN);

  // The settled day = the most recent completed game date in the pool
  // (games are most-recent-first; gameDate is an ISO YYYY-MM-DD string).
  let day: string | null = null;
  for (const games of gamesByPlayer.values()) {
    const d = games[0]?.gameDate;
    if (d && (day === null || d > day)) day = d;
  }
  if (!day) return null;
  const ageMs = Date.now() - new Date(`${day}T00:00:00Z`).getTime();
  if (ageMs > RECAP_MAX_AGE_DAYS * 86_400_000) return null;

  const candidates: RecapRow[] = [];
  for (const p of players) {
    const all = gamesByPlayer.get(p.id);
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
      // One row per player (the strongest lean) — variety over volume.
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

/**
 * Cached recap for a sport's most recent completed slate day. 6-hour cache: the
 * inputs only change once a night when box scores land, so page ISR (15 min)
 * reuses this result instead of re-running the pool scan. Null off-season, when
 * the latest games are too old, or when no lean cleared the bar.
 */
export async function getYesterdayRecap(sport: Sport): Promise<YesterdayRecap | null> {
  const cached = unstable_cache(
    async () => computeYesterdayRecap(sport),
    ['yesterday-recap', sport],
    { revalidate: 21_600, tags: [`recap-${sport}`] },
  );
  return cached().catch(() => null);
}
