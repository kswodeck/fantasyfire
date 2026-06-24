// Auto-generated plain-language "why" readout — PLAN §1 item 4.
//
// Combines recent form, the DvP matchup, and volatility into a short, factual,
// hedged paragraph. Pure function (no React/Next) so it's unit-testable and
// portable. Keep it descriptive — never predictive.
import type { HitRateResult } from './hitRate';
import type { DvpCell } from './dvp';
import type { StatKey } from './types';
import { STAT_DEFS } from './types';
import { pct, num1, ordinal } from '../format';

export interface WhyInput {
  playerName: string;
  stat: StatKey;
  line: number;
  recent: HitRateResult; // typically L10
  season: HitRateResult;
  dvp?: {
    cell: DvpCell;
    opponentAbbreviation: string;
    /** Whom the average is allowed to, e.g. "guards" (NBA) or "hitters" (MLB). */
    unitLabel?: string;
  } | null;
}

/** Describe how soft/tough a DvP rank is (1 = allows most). */
function matchupWord(rank: number, total: number): string {
  if (total <= 1) return 'an unranked';
  const tertile = rank / total;
  if (tertile <= 1 / 3) return 'a favorable';
  if (tertile >= 2 / 3) return 'a tough';
  return 'a middling';
}

/** Describe volatility from the coefficient of variation. */
function volatilityWord(mean: number | null, stdev: number | null): string {
  if (mean === null || stdev === null || mean === 0) return 'variable';
  const cv = stdev / Math.abs(mean);
  if (cv < 0.25) return 'fairly steady';
  if (cv < 0.45) return 'moderately variable';
  return 'highly variable';
}

export function buildWhyText(input: WhyInput): string {
  const { playerName, stat, line, recent, season, dvp } = input;
  const short = STAT_DEFS[stat].short;
  const sentences: string[] = [];

  // 1) Recent form vs the line.
  if (recent.decided > 0) {
    const seasonClause =
      season.hitRateOver !== null
        ? ` — versus ${pct(season.hitRateOver)} across the full season`
        : '';
    sentences.push(
      `Over his last ${recent.games} games, ${playerName} has gone over ${line} ${short} ` +
        `${recent.overs} of ${recent.decided} decided times (${pct(recent.hitRateOver)})${seasonClause}.`,
    );
  } else {
    sentences.push(
      `${playerName} has no recent decided games against a ${line} ${short} line.`,
    );
  }

  // 2) Matchup (DvP / opposing-pitching allowed).
  if (dvp) {
    const { cell, opponentAbbreviation, unitLabel = 'this group' } = dvp;
    const word = matchupWord(cell.rank, cell.totalRanked);
    const sample = cell.lowSample ? ' (small sample — read with caution)' : '';
    sentences.push(
      `${opponentAbbreviation} has been ${word} matchup for ${unitLabel} this season, ` +
        `allowing the ${ordinal(cell.rank)}-most ${short} of ${cell.totalRanked} teams ` +
        `(${num1(cell.avgAllowed)} per game)${sample}.`,
    );
  }

  // 3) Volatility.
  sentences.push(
    `His game-to-game ${short} have been ${volatilityWord(season.mean, season.stdev)} ` +
      `(σ ≈ ${num1(season.stdev)}), so short streaks can mislead.`,
  );

  // 4) Honest hedge.
  sentences.push(
    'These are descriptive stats about past games, not predictions or betting advice.',
  );

  return sentences.join(' ');
}
