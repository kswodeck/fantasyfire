'use client';

import type { ProvidedVariant } from '@/lib/types';
import { PayoutGlyph, formatMultiplier } from './PayoutBadge';
import { payoutKind, shownBreakeven, type PayoutKind } from '@/lib/payoutVariant';

// min-h/min-w-6 (24px) keeps these tiny chips at the WCAG 2.5.8 minimum target size.
const CHIP =
  'inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none transition-colors';

function rungsOfKind(variants: ProvidedVariant[], kind: PayoutKind): ProvidedVariant[] {
  return variants.filter((v) => payoutKind(v.oddsType) === kind).sort((a, b) => a.line - b.line);
}

function nearest(rungs: ProvidedVariant[], to: number): ProvidedVariant {
  return rungs.reduce((best, r) => (Math.abs(r.line - to) < Math.abs(best.line - to) ? r : best));
}

/**
 * The compact payout-variant switcher: a demon chip, a goblin chip, and a single
 * cycling alternate chip — shared by the board rows and the player page. The standard
 * line is the no-chip-highlighted state; clicking an inactive chip funnels to the
 * nearest rung of that kind, clicking the active one walks the kind's ladder and then
 * returns to the standard line (when the book has one). Chips keep a FIXED structure
 * across clicks — nothing moves under the pointer mid-cycle.
 */
export function VariantChips({
  variants,
  line,
  onSelect,
  className = '',
}: {
  variants: ProvidedVariant[];
  /** The currently-selected line. */
  line: number;
  onSelect: (line: number) => void;
  className?: string;
}) {
  const currentRung = variants.find((v) => v.line === line) ?? null;
  const activeKind = payoutKind(currentRung?.oddsType);
  const normals = rungsOfKind(variants, 'normal');

  // Funnel back to the plain/standard line (nearest normal rung) when the book has one.
  const toNormal = () => {
    if (normals.length > 0) onSelect(nearest(normals, line).line);
  };

  // Click a chip: switch to that kind (nearest the current line); clicking the
  // already-active kind cycles its rungs, then funnels back to the standard line
  // (no chip highlighted) — so every rung AND the plain line are reachable in place.
  const pickKind = (kind: PayoutKind) => {
    const rungs = rungsOfKind(variants, kind);
    if (rungs.length === 0) return;
    if (kind === activeKind) {
      const idx = rungs.findIndex((r) => r.line === line);
      if (idx >= 0 && idx < rungs.length - 1) onSelect(rungs[idx + 1].line);
      else if (normals.length > 0) toNormal();
      else onSelect(rungs[0].line); // no standard line to return to — wrap around
    } else {
      onSelect(nearest(rungs, line).line);
    }
  };

  const glyphChip = (kind: 'demon' | 'goblin') => {
    if (rungsOfKind(variants, kind).length === 0) return null;
    const active = kind === activeKind;
    const target = active ? currentRung : nearest(rungsOfKind(variants, kind), line);
    const bk = target ? Math.round(shownBreakeven(target, variants) * 100) : 50;
    const tone =
      kind === 'demon'
        ? active
          ? 'border-demon/40 bg-demon/12 text-demon'
          : 'border-line text-muted hover:text-demon'
        : active
          ? 'border-goblin/40 bg-goblin/12 text-goblin'
          : 'border-line text-muted hover:text-goblin';
    return (
      <button
        key={kind}
        type="button"
        onClick={() => pickKind(kind)}
        aria-pressed={active}
        // The chip is icon-only; title text is too verbose (and unreliable) as a name.
        aria-label={kind === 'demon' ? 'Demon line — pays more' : 'Goblin line — pays less'}
        title={`${
          kind === 'demon'
            ? 'Demon — harder line, pays more (over only).'
            : 'Goblin — easier line, pays less (over only).'
        } Scored vs its ~${bk}% payout breakeven${
          target?.read ? ` (FireFactor ${target.read.score} at ${target.line})` : ''
        }. Click again to cycle, ending on the standard line.`}
        className={`${CHIP} ${tone}`}
      >
        <PayoutGlyph kind={kind} size={12} />
      </button>
    );
  };

  const alternateChip = () => {
    const rungs = rungsOfKind(variants, 'alternate');
    if (rungs.length === 0) return null;
    const active = activeKind === 'alternate';
    const shown = active ? currentRung : nearest(rungs, line);
    const tone = active
      ? 'border-heat-1/40 bg-heat-1/12 text-heat-1'
      : 'border-line text-muted hover:text-foreground';
    const altBk =
      shown?.multiplier != null
        ? ` Scored vs its ~${Math.round(shownBreakeven(shown, variants) * 100)}% payout breakeven${
            shown.read ? ` (FireFactor ${shown.read.score} at ${shown.line})` : ''
          }.`
        : '';
    return (
      <button
        type="button"
        onClick={() => pickKind('alternate')}
        aria-pressed={active}
        aria-label={`Alternate line${
          shown?.multiplier != null ? ` — ${formatMultiplier(shown.multiplier)} payout` : ''
        }`}
        title={`Alternate line${shown?.multiplier != null ? ` — ${formatMultiplier(shown.multiplier)} payout` : ''} (over only).${altBk} ${
          rungs.length > 1
            ? 'Click to cycle the alternate ladder, then back to the standard line.'
            : 'Click again for the standard line.'
        }`}
        // Fixed min-width so a changing multiplier label ("1.5×" → "1.31×") can't
        // resize the chip mid-cycle — part of the layout-stability contract.
        className={`${CHIP} min-w-[2.75rem] justify-center ${tone}`}
      >
        <span className="tabular-nums">
          {shown?.multiplier != null ? formatMultiplier(shown.multiplier) : 'alt'}
        </span>
      </button>
    );
  };

  return (
    <span className={`flex items-center gap-1 ${className}`}>
      {glyphChip('demon')}
      {glyphChip('goblin')}
      {alternateChip()}
    </span>
  );
}
