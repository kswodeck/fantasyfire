// MLB park factors — a small static yearly table (PLAN/GROWTH §L6). Pure (no
// React/Next/db). Keyed by the MLB (statsapi) team id, which is stable across the
// abbreviation churn (e.g. Athletics OAK→ATH, Arizona ARI/AZ), so a lookup never
// silently degrades to neutral because a code changed.
//
// 1.00 = league-neutral. Values are representative recent multi-year park factors
// (runs = overall run scoring; hr = home runs), rounded — refresh annually. They
// are surfaced as MATCHUP CONTEXT, not folded into hit rates: a player's game log
// already embeds the parks they played in, and silently re-weighting it would shift
// every number retroactively under users. Use `parkAdjust` only for an explicitly
// labeled, supplementary "park-adjusted" figure.

export interface ParkFactor {
  name: string;
  /** Overall run-scoring factor (1.00 neutral). */
  runs: number;
  /** Home-run factor (1.00 neutral). */
  hr: number;
}

/** Keyed by MLB statsapi team id. */
export const MLB_PARK_FACTORS: Record<number, ParkFactor> = {
  109: { name: 'Chase Field', runs: 1.02, hr: 1.03 }, // ARI
  144: { name: 'Truist Park', runs: 1.0, hr: 1.01 }, // ATL
  110: { name: 'Camden Yards', runs: 1.0, hr: 1.05 }, // BAL
  111: { name: 'Fenway Park', runs: 1.08, hr: 0.97 }, // BOS
  112: { name: 'Wrigley Field', runs: 1.01, hr: 1.02 }, // CHC
  145: { name: 'Rate Field', runs: 1.01, hr: 1.06 }, // CWS
  113: { name: 'Great American Ball Park', runs: 1.05, hr: 1.18 }, // CIN
  114: { name: 'Progressive Field', runs: 0.98, hr: 0.97 }, // CLE
  115: { name: 'Coors Field', runs: 1.2, hr: 1.16 }, // COL
  116: { name: 'Comerica Park', runs: 0.96, hr: 0.91 }, // DET
  117: { name: 'Daikin Park', runs: 1.0, hr: 1.02 }, // HOU
  118: { name: 'Kauffman Stadium', runs: 1.02, hr: 0.93 }, // KC
  108: { name: 'Angel Stadium', runs: 0.98, hr: 1.02 }, // LAA
  119: { name: 'Dodger Stadium', runs: 1.0, hr: 1.08 }, // LAD
  146: { name: 'loanDepot park', runs: 0.94, hr: 0.92 }, // MIA
  158: { name: 'American Family Field', runs: 1.01, hr: 1.05 }, // MIL
  142: { name: 'Target Field', runs: 0.99, hr: 0.98 }, // MIN
  121: { name: 'Citi Field', runs: 0.96, hr: 0.95 }, // NYM
  147: { name: 'Yankee Stadium', runs: 1.02, hr: 1.12 }, // NYY
  133: { name: 'Sutter Health Park', runs: 1.02, hr: 1.03 }, // ATH (Athletics, Sacramento)
  143: { name: 'Citizens Bank Park', runs: 1.03, hr: 1.09 }, // PHI
  134: { name: 'PNC Park', runs: 0.97, hr: 0.9 }, // PIT
  135: { name: 'Petco Park', runs: 0.95, hr: 0.96 }, // SD
  137: { name: 'Oracle Park', runs: 0.92, hr: 0.85 }, // SF
  136: { name: 'T-Mobile Park', runs: 0.93, hr: 0.95 }, // SEA
  138: { name: 'Busch Stadium', runs: 0.97, hr: 0.92 }, // STL
  139: { name: 'Steinbrenner Field', runs: 1.01, hr: 1.04 }, // TB (temp home 2025)
  140: { name: 'Globe Life Field', runs: 1.0, hr: 1.0 }, // TEX
  141: { name: 'Rogers Centre', runs: 1.01, hr: 1.03 }, // TOR
  120: { name: 'Nationals Park', runs: 1.0, hr: 1.0 }, // WSH
};

export type ParkTilt = 'hitter' | 'pitcher' | 'neutral';

/** Above this is "hitter-friendly", below the reciprocal is "pitcher-friendly". */
export const PARK_TILT_THRESHOLD = 0.04;

export interface ParkContext extends ParkFactor {
  tilt: ParkTilt;
}

/** Classify a factor into a hitter/pitcher/neutral tilt. */
export function parkTilt(runsFactor: number): ParkTilt {
  if (runsFactor >= 1 + PARK_TILT_THRESHOLD) return 'hitter';
  if (runsFactor <= 1 - PARK_TILT_THRESHOLD) return 'pitcher';
  return 'neutral';
}

/** Park context for an MLB team id, or null if unknown (treated as neutral). */
export function parkFor(teamExternalId: number | null | undefined): ParkContext | null {
  if (teamExternalId == null) return null;
  const pf = MLB_PARK_FACTORS[teamExternalId];
  if (!pf) return null;
  return { ...pf, tilt: parkTilt(pf.runs) };
}

/** The relevant factor for a stat category (1.00 if unknown). */
export function parkFactor(
  teamExternalId: number | null | undefined,
  category: 'runs' | 'hr',
): number {
  const pf = parkFor(teamExternalId);
  return pf ? pf[category] : 1;
}

/**
 * Nudge a projection by a park factor, shrunk toward no-effect so it stays a gentle
 * tilt rather than a hard multiply (parks affect rate, not every plate appearance).
 * `shrink` 0..1: 1 = full factor, 0 = no adjustment. For a clearly LABELED
 * "park-adjusted" figure only — never the primary hit-rate math.
 */
export function parkAdjust(projection: number, factor: number, shrink = 0.5): number {
  const effective = 1 + (factor - 1) * shrink;
  return projection * effective;
}
