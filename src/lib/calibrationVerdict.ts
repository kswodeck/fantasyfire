// Turns the /accuracy calibration into a data-driven judgment of whether FireScore
// has earned its keep yet — so the "experimental" label is decided by the realized
// track record, not left hardcoded forever. Pure (no React/Next/db).
import type { Calibration } from './types';
import { pct } from './format';

export type CalibrationStatus = 'insufficient' | 'developing' | 'validated';

export interface CalibrationVerdict {
  status: CalibrationStatus;
  /** Short chip label. */
  badge: string;
  /** One-sentence plain-language summary for under the heading. */
  headline: string;
}

/** Below this many graded leans (per sport) we can't judge anything yet. */
export const CALIBRATION_MIN_GRADED = 100;
/** The strong-lean tier needs at least this many graded results to trust it. */
export const CALIBRATION_STRONG_MIN_DECIDED = 40;
/** How much the strong tier must beat the weakest lean tier to count as "discriminating". */
export const CALIBRATION_DISCRIMINATION = 0.03;

const TIER = (cal: Calibration, label: string) => cal.buckets.find((b) => b.label === label);

/**
 * Decide whether the FireScore signal is validated, still developing, or has too
 * little data. "Validated" requires the Strong-lean tier to (a) have a real sample,
 * (b) clear 50% on its 95% Wilson LOWER bound (not just the point estimate), and
 * (c) actually beat the weakest lean tier — i.e. the tiers discriminate.
 */
export function calibrationVerdict(cal: Calibration): CalibrationVerdict {
  if (cal.totalGraded < CALIBRATION_MIN_GRADED) {
    return {
      status: 'insufficient',
      badge: 'experimental',
      headline: `Only ${cal.totalGraded} graded lean${cal.totalGraded === 1 ? '' : 's'} so far — too few to judge. Treat FireScore as experimental.`,
    };
  }

  const strong = TIER(cal, 'Strong lean');
  const slight = TIER(cal, 'Slight lean');

  const strongClears50 =
    !!strong && strong.decided >= CALIBRATION_STRONG_MIN_DECIDED && strong.lower > 0.5;
  const discriminates =
    !!strong &&
    !!slight &&
    strong.winRate !== null &&
    slight.winRate !== null &&
    strong.winRate - slight.winRate >= CALIBRATION_DISCRIMINATION;

  if (strongClears50 && discriminates) {
    return {
      status: 'validated',
      badge: 'validated',
      headline: `Strong leans have landed ${pct(strong!.winRate)} (95% lower bound ${pct(strong!.lower)}, above a coin flip) and outpaced weaker tiers — the signal is discriminating.`,
    };
  }

  return {
    status: 'developing',
    badge: 'developing',
    headline: `${cal.totalGraded} graded leans in. The stronger tiers ${discriminates ? 'are starting to separate from' : 'have not yet clearly separated from'} the weaker ones — still developing.`,
  };
}
