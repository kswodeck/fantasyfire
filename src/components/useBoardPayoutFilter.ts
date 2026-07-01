'use client';

import { useMemo, useState } from 'react';
import type { BoardRow, ProvidedVariant } from '@/lib/types';
import { payoutKind, type PayoutKind } from '@/lib/payoutVariant';

// The board's payout filter has two mutually-exclusive modes, chosen by what the
// current book offers:
//   • 'type'  — PrizePicks: a multiselect of Standard / Demons / Goblins. Default is
//               all on (prefer-normal-fallback), so every player shows once; narrowing
//               keeps only rows with a rung of a selected kind, re-shown at that kind.
//   • 'mult'  — a book with numeric multipliers (Underdog alternates): a min–max range;
//               keep rows with a rung whose multiplier falls in range.
//   • 'none'  — no variants to filter (plain sportsbook board).
export type PayoutFilterMode = 'type' | 'mult' | 'none';

const TYPE_ORDER: PayoutKind[] = ['normal', 'demon', 'goblin'];

function rungKinds(row: BoardRow): PayoutKind[] {
  const set = new Set<PayoutKind>();
  for (const v of row.variants ?? []) set.add(payoutKind(v.oddsType));
  return [...set];
}

function nearest(rungs: ProvidedVariant[], to: number): ProvidedVariant {
  return rungs.reduce((best, r) => (Math.abs(r.line - to) < Math.abs(best.line - to) ? r : best));
}

export interface BoardPayoutFilter {
  mode: PayoutFilterMode;
  /** Type mode: kinds present across the board (for the chip options), in display order. */
  kindOptions: PayoutKind[];
  /** Type mode: currently-selected kinds. */
  selectedKinds: Set<PayoutKind>;
  toggleKind: (k: PayoutKind) => void;
  /** Mult mode: full data bounds + the active [min,max] window. */
  multBounds: [number, number];
  multRange: [number, number];
  setMultRange: (r: [number, number]) => void;
  /** Rows after the payout filter. */
  rows: BoardRow[];
  /** Per `${slug}:${stat}` → the rung line to open the row on (when it differs from the
   *  server representative), so a filtered row shows its selected-kind/in-range rung. */
  initialLines: Map<string, number>;
  /** True when the filter is doing something (for a "clear" affordance). */
  active: boolean;
}

/** Board payout filtering (PrizePicks types / Underdog multiplier range). Pure over the
 *  already-fetched rows — no refetch here; the row card recomputes lazily if its opening
 *  rung differs from the server one. */
export function useBoardPayoutFilter(rows: BoardRow[]): BoardPayoutFilter {
  const hasTypes = useMemo(
    () => rows.some((r) => rungKinds(r).some((k) => k === 'demon' || k === 'goblin')),
    [rows],
  );
  const hasMult = useMemo(
    () => rows.some((r) => (r.variants ?? []).some((v) => payoutKind(v.oddsType) === 'alternate' && v.multiplier != null)),
    [rows],
  );
  const mode: PayoutFilterMode = hasTypes ? 'type' : hasMult ? 'mult' : 'none';

  const kindOptions = useMemo(() => {
    const present = new Set<PayoutKind>();
    for (const r of rows) for (const k of rungKinds(r)) if (k !== 'alternate') present.add(k);
    return TYPE_ORDER.filter((k) => present.has(k));
  }, [rows]);

  const multBounds = useMemo<[number, number]>(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows)
      for (const v of r.variants ?? [])
        if (v.multiplier != null) {
          lo = Math.min(lo, v.multiplier);
          hi = Math.max(hi, v.multiplier);
        }
    return Number.isFinite(lo) ? [lo, hi] : [1, 1];
  }, [rows]);

  // `null` = "not narrowed yet" so the defaults track the current book's data.
  const [selected, setSelected] = useState<Set<PayoutKind> | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const selectedKinds = useMemo(() => selected ?? new Set(kindOptions), [selected, kindOptions]);
  const multRange = useMemo<[number, number]>(() => range ?? multBounds, [range, multBounds]);

  const toggleKind = (k: PayoutKind) => {
    setSelected((prev) => {
      const base = prev ?? new Set(kindOptions);
      const next = new Set(base);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      // Never let the board go fully empty via the filter — re-selecting all is the floor.
      return next.size === 0 ? new Set(kindOptions) : next;
    });
  };

  const { filtered, initialLines } = useMemo(() => {
    const initialLines = new Map<string, number>();
    if (mode === 'none') return { filtered: rows, initialLines };

    const out: BoardRow[] = [];
    for (const r of rows) {
      const variants = r.variants ?? [];
      if (mode === 'type') {
        // Highest-priority selected kind the row actually has → its nearest rung.
        let chosen: ProvidedVariant | null = null;
        for (const k of TYPE_ORDER) {
          if (!selectedKinds.has(k)) continue;
          const rungs = variants.filter((v) => payoutKind(v.oddsType) === k);
          if (rungs.length) {
            chosen = nearest(rungs, r.line);
            break;
          }
        }
        if (!chosen) continue; // row has no rung of any selected kind → hide
        out.push(r);
        if (chosen.line !== r.line) initialLines.set(`${r.player.slug}:${r.stat}`, chosen.line);
      } else {
        // mult mode: keep rows with a rung whose multiplier is in range; open on the
        // nearest such rung to the server line.
        const [lo, hi] = multRange;
        const inRange = variants.filter((v) => v.multiplier != null && v.multiplier >= lo - 1e-9 && v.multiplier <= hi + 1e-9);
        if (!inRange.length) continue;
        out.push(r);
        const chosen = nearest(inRange, r.line);
        if (chosen.line !== r.line) initialLines.set(`${r.player.slug}:${r.stat}`, chosen.line);
      }
    }
    return { filtered: out, initialLines };
  }, [rows, mode, selectedKinds, multRange]);

  const active =
    mode === 'type'
      ? selectedKinds.size !== kindOptions.length
      : mode === 'mult'
        ? multRange[0] !== multBounds[0] || multRange[1] !== multBounds[1]
        : false;

  return {
    mode,
    kindOptions,
    selectedKinds,
    toggleKind,
    multBounds,
    multRange,
    setMultRange: (r) => setRange(r),
    rows: filtered,
    initialLines,
    active,
  };
}
