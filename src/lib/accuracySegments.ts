// Pure segmentation of settled leans for the accuracy page's tier/side filters.
// No React/Next/db — unit-tested. The tier→segment map mirrors tierStyle's heat
// words: Strong lean = Blazing/Frozen (extreme), Lean = Hot/Cold (normal),
// Slight lean = Warm/Cool (slight). No-lean/Pass are never settled, so they map
// to null and contribute to no segment.
import type { FireTier } from './stats/fireScore';
import type {
  AccuracyBreakdown,
  AccuracySideFilter,
  AccuracySideRecords,
  LeanTierSegment,
  RecapRow,
  WinRecord,
} from './types';

/** The strength segment a lean's tier belongs to, or null when it isn't a
 *  settled lean (No lean / Pass). */
export function tierSegmentOf(tier: FireTier): LeanTierSegment | null {
  switch (tier) {
    case 'Strong lean':
      return 'extreme';
    case 'Lean':
      return 'normal';
    case 'Slight lean':
      return 'slight';
    default:
      return null;
  }
}

/** True when a row belongs to the selected tier segment ('all' = any) and side
 *  ('both' = any). The single predicate the UI filters day rows with. */
export function rowMatches(
  r: RecapRow,
  tier: LeanTierSegment | 'all',
  side: AccuracySideFilter,
): boolean {
  if (tier !== 'all' && tierSegmentOf(r.tier) !== tier) return false;
  if (side !== 'both' && r.side !== side) return false;
  return true;
}

const emptyRecord = (): WinRecord => ({ hits: 0, misses: 0, pushes: 0 });
const emptySide = (): AccuracySideRecords => ({
  both: emptyRecord(),
  over: emptyRecord(),
  under: emptyRecord(),
});

function tally(rec: WinRecord, result: RecapRow['result']): void {
  if (result === 'hit') rec.hits += 1;
  else if (result === 'miss') rec.misses += 1;
  else rec.pushes += 1;
}

/** Tier × side records over a set of settled rows. Every row lands in `all` and
 *  (if it's a real lean) its own segment; within each, in `both` and its side. */
export function computeBreakdown(rows: RecapRow[]): AccuracyBreakdown {
  const b: AccuracyBreakdown = {
    all: emptySide(),
    extreme: emptySide(),
    normal: emptySide(),
    slight: emptySide(),
  };
  for (const r of rows) {
    const seg = tierSegmentOf(r.tier);
    const keys: (keyof AccuracyBreakdown)[] = seg ? ['all', seg] : ['all'];
    for (const key of keys) {
      tally(b[key].both, r.result);
      tally(b[key][r.side], r.result);
    }
  }
  return b;
}

/** Read a segment×side record out of a breakdown ('all' tier spans everything). */
export function recordFor(
  breakdown: AccuracyBreakdown,
  tier: LeanTierSegment | 'all',
  side: AccuracySideFilter,
): WinRecord {
  return breakdown[tier][side];
}

/** UI metadata for the tier segment control (order: all → strongest → slightest). */
export const TIER_SEGMENT_OPTIONS: {
  key: LeanTierSegment | 'all';
  label: string;
  hint: string;
}[] = [
  { key: 'all', label: 'All leans', hint: 'Every settled lean' },
  { key: 'extreme', label: 'Extreme', hint: 'Blazing / Frozen' },
  { key: 'normal', label: 'Normal', hint: 'Hot / Cold' },
  { key: 'slight', label: 'Slight', hint: 'Warm / Cool' },
];

/** UI metadata for the side control. */
export const SIDE_FILTER_OPTIONS: { key: AccuracySideFilter; label: string }[] = [
  { key: 'both', label: 'Both' },
  { key: 'over', label: 'Over' },
  { key: 'under', label: 'Under' },
];
