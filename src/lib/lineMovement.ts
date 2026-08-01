// Did the book move the line since the user saved this prop?
//
// A saved prop pins the exact number the user was looking at (savedProps.ts). The
// book keeps re-pricing it every providedlines ingest, so by the time they open
// the Playbook the prop may sit at a different number — the one thing a DFS app
// never tells you, and the reason to come back before locking a card.
//
// Pure (no React/Next/db): the Playbook already fetches each prop's research, which
// carries the source's CURRENT variant ladder, so this is a comparison, not a query.
import type { ProvidedVariant } from './types';
import type { PropSide } from './savedProps';
import { payoutKind, type PayoutKind } from './payoutVariant';

export interface LineMovement {
  /** 'moved' — the rung is still listed at a different number.
   *  'unlisted' — the book still prices this stat, but no longer at this rung kind. */
  status: 'moved' | 'unlisted';
  savedLine: number;
  /** The book's current line for the saved rung kind; null when 'unlisted'. */
  currentLine: number | null;
  /** current − saved (signed). 0 when 'unlisted'. */
  delta: number;
  /**
   * Whether the move helps the side the user saved. A higher number is harder to
   * clear, so it helps an under and hurts an over; a lower number is the reverse.
   * Meaningless (false) when 'unlisted'.
   */
  favorable: boolean;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The book's current line for one rung kind (median when a kind has several). */
export function lineForKind(variants: ProvidedVariant[], kind: PayoutKind): number | null {
  return median(variants.filter((v) => payoutKind(v.oddsType) === kind).map((v) => v.line));
}

/**
 * Compare a saved prop's line against the source's current ladder.
 *
 * Returns null when there is nothing trustworthy to say — an empty ladder means
 * either the provided-lines feature is off or we simply have no lines for this
 * stat right now, and neither is evidence the book pulled the prop. Only a ladder
 * that exists but has lost this rung kind reports 'unlisted'.
 *
 * Rungs are compared WITHIN their payout kind: a goblin save is measured against
 * today's goblin, never against the standard line (different payout, different bet).
 */
export function lineMovement(
  saved: { line: number; side: PropSide; oddsType?: string | null },
  variants: ProvidedVariant[],
): LineMovement | null {
  if (variants.length === 0) return null;
  const kind = payoutKind(saved.oddsType);
  const currentLine = lineForKind(variants, kind);
  if (currentLine === null) {
    return { status: 'unlisted', savedLine: saved.line, currentLine: null, delta: 0, favorable: false };
  }
  const delta = currentLine - saved.line;
  if (delta === 0) return null;
  return {
    status: 'moved',
    savedLine: saved.line,
    currentLine,
    delta,
    favorable: saved.side === 'under' ? delta > 0 : delta < 0,
  };
}

/** Short human phrasing for the movement chip, e.g. "0.5 → 1.5". */
export function movementLabel(m: LineMovement): string {
  if (m.status === 'unlisted') return 'no longer listed';
  return `${m.savedLine} → ${m.currentLine}`;
}
