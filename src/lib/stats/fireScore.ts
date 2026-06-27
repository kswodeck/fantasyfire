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
//  - It FUSES EVIDENCE IN LOG-ODDS: each component is a 0-1 sub-score, but they
//    combine as a weighted sum of LOG-ODDS (not a weighted average of the raw
//    sub-scores). A neutral component (~0.5) contributes ZERO and abstains rather
//    than dragging a strong read back toward the middle; a confident component
//    moves the result in its direction.
//  - It DEGRADES GRACEFULLY: any missing component (no projection, no matchup, no
//    price) simply isn't in the sum — same as a neutral one. A missing input never
//    inflates the score, it only pulls the read toward 50/50 (widens uncertainty).
//  - It reads recent form as NON-OVERLAPPING buckets (games 1-5, 6-10, 11-20, 21+)
//    derived from the cumulative windows, so the most-recent games are weighted up
//    by recency WITHOUT being double-counted across nested windows.
//  - LEAN mode (default, free, no price) reads recent history vs the line. VALUE
//    mode (only when the user enters a real price) adds the one legitimate
//    "value vs the price you entered — not a guarantee" component.
import { wilsonInterval } from './confidence';
import type { MatchupGrade } from './dvp';

export type FireSide = 'over' | 'under';
export type FireTier = 'Strong lean' | 'Lean' | 'Slight lean' | 'No lean' | 'Pass';

/** Component weights (LEAN mode) — multipliers on each component's log-odds in the
 *  evidence sum. Whichever components are present contribute; the rest abstain. */
export const FIREFACTOR_WEIGHTS = { hit: 0.34, proj: 0.24, consistency: 0.16, matchup: 0.14 } as const;
/** In VALUE mode, how the signal blend and the price-value split the score. */
export const FIREFACTOR_VALUE_SPLIT = { signal: 0.7, value: 0.3 } as const;
/** 0-100 cutoffs for the tier label. The read floor (`slight`) is set just below the
 *  dense middle of the score distribution, so a borderline edge surfaces as an honest
 *  "Slight lean" rather than collapsing to "No read"; Lean/Strong stay scarce. */
export const FIREFACTOR_TIER_CUTOFFS = { strong: 66, lean: 56, slight: 40, none: 28 } as const;
/** Below this many games we never grade above "Pass". */
export const FIREFACTOR_MIN_GAMES = 5;
/** The hit sub-score reaches 1.0 this far above a 50% rate — at 0.17, a 60% over rate
 *  contributes positively (~0.59) instead of scoring neutral, so real edges in the
 *  55–65% band register without over-rewarding them. */
export const FIREFACTOR_HIT_SPAN = 0.17;
/** Cross-book line value: boost = clamp(0, edge * gain, cap) added to the 0-100 score,
 *  so a genuine discount can lift the read up a tier but can't manufacture one alone. */
export const FIREFACTOR_LINE_VALUE = { gain: 40, cap: 10 } as const;
/** Recency weight per non-overlapping bucket (keyed by the cumulative window it
 *  came from) when blending the Wilson bounds. Recent games count for more. */
export const FIREFACTOR_WINDOW_RECENCY: Record<string, number> = {
  '5': 1.3,
  '10': 1.2,
  '20': 1.0,
  season: 0.8,
};
/** Cumulative game count each window label covers (used to split nested windows
 *  into disjoint buckets). 'season' (and anything unknown) is open-ended. */
const WINDOW_CUTOFF: Record<string, number> = { '5': 5, '10': 10, '20': 20, season: Infinity };
function windowCutoff(label: string): number {
  if (label in WINDOW_CUTOFF) return WINDOW_CUTOFF[label];
  const n = Number(label);
  return Number.isFinite(n) ? n : Infinity;
}
/** Sub-scores are clamped away from 0/1 before logit so a single perfect/zero
 *  component can't dominate the sum with an infinite log-odds. */
const LOGIT_CLAMP = 0.05;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (s: number) => {
  const c = Math.max(LOGIT_CLAMP, Math.min(1 - LOGIT_CLAMP, s));
  return Math.log(c / (1 - c));
};
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
  /** Adjusted projection (matchup-aware); null drops the projection component. */
  projection: number | null;
  /** Population stdev of the window (for the projection z-score fallback). */
  stdev: number | null;
  /** Model P(stat > line) from the projection's distribution (distribution.ts). When
   *  present it drives the projection component directly; else we fall back to the
   *  stdev z-score. This is the principled "projection vs line" probability. */
  modelProbOver?: number | null;
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
  /** Total games available. Kept for callers/back-compat; the Pass floor now gates
   *  on the total DECIDED games across the (de-overlapped) windows, not this. */
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

interface Bucket {
  window: string;
  overs: number;
  decided: number;
}

/**
 * Turn the CUMULATIVE windows (L5 ⊂ L10 ⊂ L20 ⊂ season) into NON-OVERLAPPING
 * buckets (games 1-5, 6-10, 11-20, 21+) by subtracting each window from the next.
 * Without this the most-recent games sit in every window and get counted 3-4×;
 * disjoint buckets let recency weighting up-weight them without double-counting.
 */
function disjointBuckets(windows: WindowHits[]): Bucket[] {
  const sorted = windows
    .filter((w) => w.decided > 0)
    .slice()
    .sort((a, b) => windowCutoff(a.window) - windowCutoff(b.window) || a.decided - b.decided);
  const out: Bucket[] = [];
  let prevOvers = 0;
  let prevDecided = 0;
  for (const w of sorted) {
    const decided = w.decided - prevDecided;
    const overs = w.overs - prevOvers;
    prevOvers = w.overs;
    prevDecided = w.decided;
    if (decided > 0) out.push({ window: w.window, overs: clamp01(overs / decided) * decided, decided });
  }
  return out;
}

/** Recency-weighted blend of a side's Wilson bounds across disjoint buckets.
 *  `decided` is the total over all buckets — the honest (non-double-counted) sample. */
function blendWilson(
  windows: WindowHits[],
  side: FireSide,
): { lower: number; center: number; decided: number } | null {
  let lowerNum = 0;
  let centerNum = 0;
  let den = 0;
  let decided = 0;
  for (const b of disjointBuckets(windows)) {
    const successes = side === 'over' ? b.overs : b.decided - b.overs;
    const iv = wilsonInterval(successes, b.decided);
    const wt = b.decided * (FIREFACTOR_WINDOW_RECENCY[b.window] ?? 1);
    lowerNum += wt * iv.lower;
    centerNum += wt * iv.center;
    den += wt;
    decided += b.decided;
  }
  return den === 0 ? null : { lower: lowerNum / den, center: centerNum / den, decided };
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
  const { line, windows, projection, stdev, cv, matchup, evPerDollar, lineValueEdge, modelProbOver } =
    input;

  // Side = the side recent history leans (blended Wilson CENTER of the over).
  const overBlend = blendWilson(windows, 'over');
  const side: FireSide = overBlend && overBlend.center >= 0.5 ? 'over' : 'under';
  const blended = blendWilson(windows, side);

  const trustFactor =
    blended === null ? 0.4 : Math.max(0.4, Math.min(1, (blended.lower + 0.1) / 0.6));

  const comps: FireFactorComponent[] = [];
  if (blended !== null) {
    // Strength = how far the leaned side's rate sits above the fair 50% point
    // (0.50 -> 0, ~0.70 -> max). We use the recency-weighted CENTER for the
    // magnitude and let `trustFactor` (derived from the Wilson lower bound) apply
    // the small-sample discount — so confidence is counted once, not twice.
    comps.push({
      key: 'hit',
      label: 'Hit rate (confidence-adjusted)',
      score: clamp01((blended.center - 0.5) / FIREFACTOR_HIT_SPAN),
      weight: FIREFACTOR_WEIGHTS.hit,
    });
  }
  if (modelProbOver != null) {
    // Principled path: the projection's distribution gives P(over) directly.
    comps.push({
      key: 'proj',
      label: 'Projection vs line',
      score: clamp01(side === 'over' ? modelProbOver : 1 - modelProbOver),
      weight: FIREFACTOR_WEIGHTS.proj,
    });
  } else if (projection !== null && stdev !== null) {
    // Fallback when no distribution prob was supplied: a z-score sigmoid.
    const z = (projection - line) / Math.max(stdev, 0.5);
    comps.push({
      key: 'proj',
      label: 'Projection vs line',
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

  // Fuse the present components as a weighted sum of LOG-ODDS, then squash back to
  // [0,1]. A neutral 0.5 component has log-odds 0 → it abstains instead of pulling
  // the read toward the middle; a missing component is simply absent (also 0).
  const logOdds = comps.reduce((a, c) => a + c.weight * logit(c.score), 0);
  const raw = comps.length === 0 ? 0 : sigmoid(logOdds);

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
  // The boost is scaled by trustFactor too, so a thin sample can't ride a soft line to a
  // strong read — the discount is only worth as much as the history backing it.
  if (lineValueEdge != null && blended !== null) {
    comps.push({
      key: 'lineValue',
      label: 'Line value vs market',
      score: clamp01(0.5 + lineValueEdge * 2),
      weight: 0,
    });
    const boost = Math.max(0, Math.min(FIREFACTOR_LINE_VALUE.cap, lineValueEdge * FIREFACTOR_LINE_VALUE.gain));
    score += boost * trustFactor;
  }

  score = Math.round(clamp01(score / 100) * 100);

  // A line is only UNREADABLE when it has no decided games at all (all pushes / never
  // played at that number). A THIN sample — a few decided games — is still graded: the
  // Wilson-lower-bound trust factor already scales the score down hard on little data,
  // so a read is harder to reach but the line isn't thrown out. `decided` is the honest
  // non-double-counted sample from the disjoint buckets.
  const insufficient = blended === null;
  const thinSample = blended !== null && blended.decided < FIREFACTOR_MIN_GAMES;
  const tier = tierFor(score, !insufficient && score >= FIREFACTOR_TIER_CUTOFFS.none);

  const note = insufficient
    ? 'No decided games at this line yet — no read.'
    : `Recent history runs ${side} on this line${
        thinSample ? ' on a small sample, so read with extra caution' : ''
      }. Descriptive research from past games — not betting advice.`;

  return { side, score, tier, trustFactor, components: comps, valueMode, note };
}
