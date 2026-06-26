// FireFactor — the transparent "is this a good prop?" signal. Pure (no React/Next).
//
// Honest by construction:
//  - It is a RESEARCH SIGNAL, never a pick/prediction/+EV claim (enforced by the
//    banned-token test on its captions).
//  - It leads with a descriptive heat read (Blazing/Hot/Warm over · Cool/Cold/Frozen
//    under · No read); the 0-100 number is secondary and always renders with its
//    component breakdown. The internal `tier` is the side-agnostic STRENGTH; the
//    heat word + flame/snowflake icon + warm/cool color are derived in tierStyle.ts.
//  - It ranks/gates by the WILSON LOWER BOUND, so small samples and hot streaks
//    are discounted, not hyped (trustFactor drags the score down).
//  - It DEGRADES GRACEFULLY: any missing component (no projection, no matchup, no
//    price) is dropped and the remaining weights renormalize — a missing input
//    never inflates the score, it only widens uncertainty.
//  - LEAN mode (default, free, no price) reads recent history vs the line. VALUE
//    mode (only when the user enters a real price) adds the one legitimate
//    "value vs the price you entered — not a guarantee" component.
import { wilsonInterval } from './confidence';
import type { MatchupGrade } from './dvp';

export type FireSide = 'over' | 'under';
export type FireTier = 'Strong lean' | 'Lean' | 'Slight lean' | 'No lean' | 'Pass';

/** Component weights (LEAN mode), renormalized over whichever are present. */
export const FIREFACTOR_WEIGHTS = { hit: 0.34, proj: 0.24, consistency: 0.16, matchup: 0.14 } as const;
/** In VALUE mode, how the signal blend and the price-value split the score. */
export const FIREFACTOR_VALUE_SPLIT = { signal: 0.7, value: 0.3 } as const;
/** 0-100 cutoffs for the tier label. */
export const FIREFACTOR_TIER_CUTOFFS = { strong: 66, lean: 56, slight: 42, none: 28 } as const;
/** Below this many games we never grade above "Pass". */
export const FIREFACTOR_MIN_GAMES = 5;
/** Cross-book line value: boost = clamp(0, edge * gain, cap) added to the 0-100 score,
 *  so a genuine discount can lift the read up a tier but can't manufacture one alone. */
export const FIREFACTOR_LINE_VALUE = { gain: 40, cap: 10 } as const;
/** Recency weight per window when blending the Wilson lower bound. */
export const FIREFACTOR_WINDOW_RECENCY: Record<string, number> = {
  '5': 1.3,
  '10': 1.2,
  '20': 1.0,
  season: 0.8,
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const GRADE_SCORE: Record<MatchupGrade, number | null> = {
  A: 1,
  B: 0.75,
  C: 0.5,
  D: 0.25,
  F: 0,
  NR: null,
};

export interface WindowHits {
  window: string; // '5' | '10' | '20' | 'season'
  overs: number;
  decided: number;
}

export interface FireFactorInput {
  line: number;
  /** Per-window over/decided — drives the Wilson hit component + trust gate. */
  windows: WindowHits[];
  /** Stabilized recent-form estimate; null drops the projection component. */
  projection: number | null;
  /** Population stdev of the window (for the projection z-score). */
  stdev: number | null;
  /** Coefficient of variation; null drops the consistency component. */
  cv: number | null;
  /** A-F matchup grade; 'NR'/undefined drops the matchup component. */
  matchup?: MatchupGrade;
  /** EV per $1 per side from a USER-ENTERED price (VALUE mode only). */
  evPerDollar?: { over?: number | null; under?: number | null };
  /** Cross-book line value for the leaning side: this book's hit rate minus the
   *  consensus (median across books) line's hit rate. Positive = a softer/better
   *  number than the market; folds a capped boost into the score. */
  lineValueEdge?: number | null;
  /** Total games available (gates the Pass floor). */
  gamesPlayed: number;
}

export interface FireFactorComponent {
  key: string;
  label: string;
  /** Sub-score in [0,1] for the chosen side. */
  score: number;
  weight: number;
}

export interface FireFactorResult {
  side: FireSide;
  /** 0-100 — SECONDARY. Never render without `components`. */
  score: number;
  tier: FireTier;
  /** Wilson-lower-bound trust multiplier in [0.35, 1]. */
  trustFactor: number;
  components: FireFactorComponent[];
  /** True when a user-entered price drove the value component. */
  valueMode: boolean;
  /** Honest one-liner the UI must surface alongside the score. */
  note: string;
}

/** Recency-weighted blend of a side's Wilson lower bound + center across windows. */
function blendWilson(windows: WindowHits[], side: FireSide): { lower: number; center: number } | null {
  let lowerNum = 0;
  let centerNum = 0;
  let den = 0;
  for (const w of windows) {
    if (w.decided <= 0) continue;
    const successes = side === 'over' ? w.overs : w.decided - w.overs;
    const iv = wilsonInterval(successes, w.decided);
    const wt = w.decided * (FIREFACTOR_WINDOW_RECENCY[w.window] ?? 1);
    lowerNum += wt * iv.lower;
    centerNum += wt * iv.center;
    den += wt;
  }
  return den === 0 ? null : { lower: lowerNum / den, center: centerNum / den };
}

function tierFor(score: number, ok: boolean): FireTier {
  if (!ok) return 'Pass';
  if (score >= FIREFACTOR_TIER_CUTOFFS.strong) return 'Strong lean';
  if (score >= FIREFACTOR_TIER_CUTOFFS.lean) return 'Lean';
  if (score >= FIREFACTOR_TIER_CUTOFFS.slight) return 'Slight lean';
  if (score >= FIREFACTOR_TIER_CUTOFFS.none) return 'No lean';
  return 'Pass';
}

export function computeFireFactor(input: FireFactorInput): FireFactorResult {
  const { line, windows, projection, stdev, cv, matchup, evPerDollar, lineValueEdge, gamesPlayed } =
    input;

  // Side = the side recent history leans (blended Wilson CENTER of the over).
  const overBlend = blendWilson(windows, 'over');
  const side: FireSide = overBlend && overBlend.center >= 0.5 ? 'over' : 'under';
  const blended = blendWilson(windows, side);

  const trustFactor =
    blended === null ? 0.35 : Math.max(0.35, Math.min(1, (blended.lower + 0.1) / 0.6));

  const comps: FireFactorComponent[] = [];
  if (blended !== null) {
    // Strength = how far the leaned side's rate sits above the fair 50% point
    // (0.50 -> 0, ~0.70 -> max). We use the recency-weighted CENTER for the
    // magnitude and let `trustFactor` (derived from the Wilson lower bound) apply
    // the small-sample discount — so confidence is counted once, not twice.
    comps.push({
      key: 'hit',
      label: 'Hit rate (confidence-adjusted)',
      score: clamp01((blended.center - 0.5) / 0.2),
      weight: FIREFACTOR_WEIGHTS.hit,
    });
  }
  if (projection !== null && stdev !== null) {
    const z = (projection - line) / Math.max(stdev, 0.5);
    comps.push({
      key: 'proj',
      label: 'Recent-form estimate vs line',
      score: side === 'over' ? sigmoid(1.1 * z) : sigmoid(-1.1 * z),
      weight: FIREFACTOR_WEIGHTS.proj,
    });
  }
  if (cv !== null) {
    comps.push({
      key: 'consistency',
      label: 'Consistency',
      score: 1 - clamp01(cv / 0.6),
      weight: FIREFACTOR_WEIGHTS.consistency,
    });
  }
  if (matchup && GRADE_SCORE[matchup] !== null) {
    const g = GRADE_SCORE[matchup] as number;
    comps.push({
      key: 'matchup',
      label: 'Matchup',
      score: side === 'over' ? g : 1 - g,
      weight: FIREFACTOR_WEIGHTS.matchup,
    });
  }

  const wsum = comps.reduce((a, c) => a + c.weight, 0);
  const raw = wsum === 0 ? 0 : comps.reduce((a, c) => a + c.weight * c.score, 0) / wsum;

  // VALUE mode: only when the user entered a real price for the chosen side.
  const evForSide = side === 'over' ? evPerDollar?.over : evPerDollar?.under;
  const valueMode = evForSide !== null && evForSide !== undefined;
  let score: number;
  if (valueMode) {
    const sValue = clamp01(0.5 + (evForSide as number) * 2);
    comps.push({ key: 'value', label: 'Value vs your price', score: sValue, weight: 0 });
    score = 100 * (FIREFACTOR_VALUE_SPLIT.signal * raw + FIREFACTOR_VALUE_SPLIT.value * sValue) * trustFactor;
  } else {
    score = 100 * raw * trustFactor;
  }

  // Cross-book line value: a softer number than the market lifts the score (capped), so a
  // genuine discount can nudge the read up a tier — but never conjures one from nothing.
  if (lineValueEdge != null && blended !== null) {
    comps.push({
      key: 'lineValue',
      label: 'Line value vs market',
      score: clamp01(0.5 + lineValueEdge * 2),
      weight: 0,
    });
    score += Math.max(0, Math.min(FIREFACTOR_LINE_VALUE.cap, lineValueEdge * FIREFACTOR_LINE_VALUE.gain));
  }

  score = Math.round(clamp01(score / 100) * 100);

  const insufficient = blended === null || gamesPlayed < FIREFACTOR_MIN_GAMES;
  const tier = tierFor(score, !insufficient && score >= FIREFACTOR_TIER_CUTOFFS.none);

  const note = insufficient
    ? 'Not enough decided games to read this line — treat as no read.'
    : `Recent history runs ${side} on this line. Descriptive research from past games — not betting advice.`;

  return { side, score, tier, trustFactor, components: comps, valueMode, note };
}
