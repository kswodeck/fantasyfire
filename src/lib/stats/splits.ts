// Situational splits — slice a stat by HOME/AWAY and by DAYS SINCE LAST GAME,
// each with its OWN Wilson confidence so a thin "crushes at home" split reads as
// uncertain, not as an edge. Pure (no React/Next/db). Descriptive only — these
// describe past games in that situation, not a forecast.
import { computeHitRate, type HitRateResult } from './hitRate';
import { hitRateConfidence, type Confidence } from './confidence';
import type { GameStatLine, StatKey } from './types';

export interface SplitResult {
  key: string;
  label: string;
  /** Games in this split. */
  games: number;
  hitRate: HitRateResult;
  confidence: Confidence;
}

export interface PlayerSplits {
  homeAway: SplitResult[];
  rest: SplitResult[];
}

const DAY_MS = 86_400_000;

function toSplit(
  key: string,
  label: string,
  subset: GameStatLine[],
  stat: StatKey,
  line: number,
): SplitResult {
  const hitRate = computeHitRate(subset, stat, line, 'season'); // all games in the subset
  return {
    key,
    label,
    games: subset.length,
    hitRate,
    confidence: hitRateConfidence(hitRate.overs, hitRate.decided),
  };
}

/** Home vs away (off the existing isHome flag). Empty splits are dropped. */
export function splitHomeAway(games: GameStatLine[], stat: StatKey, line: number): SplitResult[] {
  const home = games.filter((g) => g.isHome === true);
  const away = games.filter((g) => g.isHome === false);
  return [
    toSplit('home', 'Home', home, stat, line),
    toSplit('away', 'Away', away, stat, line),
  ].filter((s) => s.games > 0);
}

const REST_LABEL: Record<string, string> = {
  b2b: '0 days (B2B)',
  r1: '1 day',
  r2: '2 days',
  r3: '3+ days',
};

/** Bucket the calendar gap (in days) to the previous game into a rest bucket. */
function restBucket(gapDays: number): string {
  if (gapDays <= 1) return 'b2b';
  if (gapDays === 2) return 'r1';
  if (gapDays === 3) return 'r2';
  return 'r3';
}

/**
 * Split by DAYS SINCE THE LAST GAME (derived from gameDate gaps). Games must be
 * MOST-RECENT-FIRST (as the DB returns them); the oldest game has no prior game
 * and is excluded. Frame as "days since last game played", not literal "rest".
 */
export function splitByRest(games: GameStatLine[], stat: StatKey, line: number): SplitResult[] {
  const byBucket = new Map<string, GameStatLine[]>();
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const prev = games[i + 1]; // the next-older game
    if (!prev || !g.gameDate || !prev.gameDate) continue;
    const gap = Math.round((Date.parse(g.gameDate) - Date.parse(prev.gameDate)) / DAY_MS);
    if (!Number.isFinite(gap) || gap <= 0) continue;
    const b = restBucket(gap);
    const list = byBucket.get(b);
    if (list) list.push(g);
    else byBucket.set(b, [g]);
  }
  return ['b2b', 'r1', 'r2', 'r3']
    .filter((b) => byBucket.has(b))
    .map((b) => toSplit(b, REST_LABEL[b], byBucket.get(b)!, stat, line));
}

/** Both split families for a stat + line. */
export function computeSplits(games: GameStatLine[], stat: StatKey, line: number): PlayerSplits {
  return {
    homeAway: splitHomeAway(games, stat, line),
    rest: splitByRest(games, stat, line),
  };
}
