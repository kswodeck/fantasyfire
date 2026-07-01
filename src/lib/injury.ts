// Shared injury-designation helpers: turn a player's availability into the small
// abbreviated label (Q / D / GTD / P / OUT / IL …) shown on rows and cards, plus the
// fuller text for the hover tooltip and the canonical option list the injuries-page
// filter is built from. Pure — no DB/React imports — so both server components and
// client filters can use it freely.
import { formatIsoDate } from '@/lib/format';

/** Normalized availability bucket stored on PlayerInjury.status. */
export type InjuryStatus = 'out' | 'doubtful' | 'questionable' | 'day-to-day';

/** The fine-grained designation we classify each injured player into — the unit the
 *  abbreviated label and the injuries-page filter both operate on. Finer than the
 *  four `status` buckets (an `out` player may be flatly Out, on the IL, or suspended). */
export type DesignationKey =
  | 'out'
  | 'il'
  | 'suspended'
  | 'doubtful'
  | 'questionable'
  | 'gtd'
  | 'probable'
  | 'day-to-day';

/** The minimal availability shape the badge/tooltip need — a subset of
 *  PlayerAvailability, so any of our injury rows satisfies it. */
export interface InjuryLike {
  status: InjuryStatus;
  fantasyStatus: string | null;
  detail?: string | null;
  returnDate?: string | null;
}

type Tone = 'out' | 'caution' | 'clear';

interface DesignationMeta {
  /** Short label for the badge, e.g. "GTD". */
  abbr: string;
  /** Full human label, e.g. "Game-Time Decision". */
  label: string;
  /** Severity tone, drives the badge color. */
  tone: Tone;
}

/** Canonical metadata per designation, in rough severity order (most → least severe).
 *  Object key order is the display/filter order. */
export const DESIGNATIONS: Record<DesignationKey, DesignationMeta> = {
  out: { abbr: 'OUT', label: 'Out', tone: 'out' },
  il: { abbr: 'IL', label: 'Injured List', tone: 'out' },
  suspended: { abbr: 'SUSP', label: 'Suspended', tone: 'out' },
  doubtful: { abbr: 'D', label: 'Doubtful', tone: 'out' },
  questionable: { abbr: 'Q', label: 'Questionable', tone: 'caution' },
  gtd: { abbr: 'GTD', label: 'Game-Time Decision', tone: 'caution' },
  'day-to-day': { abbr: 'DTD', label: 'Day-to-day', tone: 'caution' },
  probable: { abbr: 'P', label: 'Probable', tone: 'clear' },
};

/** Display/filter order for designations (most severe first). */
export const DESIGNATION_ORDER = Object.keys(DESIGNATIONS) as DesignationKey[];

/**
 * Classify an injured player into a single designation. Leads with the finer
 * `fantasyStatus` (GTD / Probable / "15-Day IL") and falls back to the coarse
 * `status` bucket when ESPN omits it (e.g. NFL). Order matters: "Day-To-Day" is
 * matched before the IL day-number check so it isn't swallowed by it.
 */
export function classifyDesignation({
  status,
  fantasyStatus,
}: InjuryLike): DesignationKey {
  const s = (fantasyStatus ?? status).toLowerCase();
  if (s.includes('gtd') || (s.includes('game') && s.includes('time'))) return 'gtd';
  if (s.includes('probable')) return 'probable';
  if (s.includes('questionable')) return 'questionable';
  if (s.includes('doubtful')) return 'doubtful';
  if (s.includes('suspen')) return 'suspended'; // "Suspended" / "Suspension"
  if (s.includes('day-to-day') || s.includes('day to day')) return 'day-to-day';
  if (/\bil\b/.test(s) || s.includes('injured list') || /\d+\s*-?\s*day/.test(s))
    return 'il';
  if (s.includes('out')) return 'out';
  // Fall back to the normalized bucket.
  switch (status) {
    case 'doubtful':
      return 'doubtful';
    case 'questionable':
      return 'questionable';
    case 'day-to-day':
      return 'day-to-day';
    default:
      return 'out';
  }
}

/** The badge abbreviation + full label + tone for an injured player. */
export function injuryDesignation(
  injury: InjuryLike,
): DesignationMeta & { key: DesignationKey } {
  const key = classifyDesignation(injury);
  return { key, ...DESIGNATIONS[key] };
}

/**
 * The hover/tooltip text for a badge — the full designation plus the exact injury
 * and the expected return, when we have them: "Questionable · Right Ankle Sprain ·
 * Est. return Jun 30, 2026".
 */
export function injuryTooltip(injury: InjuryLike): string {
  const parts: string[] = [DESIGNATIONS[classifyDesignation(injury)].label];
  if (injury.detail) parts.push(injury.detail);
  if (injury.returnDate) parts.push(`Est. return ${formatIsoDate(injury.returnDate)}`);
  return parts.join(' · ');
}
