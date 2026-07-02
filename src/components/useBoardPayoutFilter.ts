'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProvidedVariant } from '@/lib/types';
import { payoutKind, type PayoutKind } from '@/lib/payoutVariant';

/** The row shape the payout filter needs — satisfied by BoardRow AND TrendRow, so the
 *  Heat Check and Trends pages share one filter. */
export interface PayoutFilterableRow {
  line: number;
  stat: string;
  player: { slug: string };
  variants?: ProvidedVariant[];
}

// The board's payout filter, driven by what the current book offers:
//   • Kind chips — a multiselect of Standard / Demons / Goblins / Alternates (only the
//     kinds present on this board). Default is STANDARD ONLY, so every page opens on
//     the plain lines; turning a kind on adds rows shown at that kind (normal-first
//     priority). PrizePicks gets Standard/Demons/Goblins, Underdog gets
//     Standard/Alternates.
//   • Multiplier range — when the book posts numeric multipliers (Underdog): a min–max
//     window that constrains which ALTERNATE rungs qualify (the standard line is never
//     range-gated — deselect Standard to see alternates only).
// Both render nothing for a plain sportsbook board with no variants.

const KIND_ORDER: PayoutKind[] = ['normal', 'demon', 'goblin', 'alternate'];

// URL params the filter round-trips through (?kinds=normal,goblin&mult=1.2-1.5), so a
// narrowed board survives refresh and pastes as the same view. Absent = defaults.
const KINDS_PARAM = 'kinds';
const MULT_PARAM = 'mult';

function parseKindsParam(raw: string | null): Set<PayoutKind> | null {
  if (raw === null) return null;
  const kinds = raw
    .split(',')
    .filter((k): k is PayoutKind => (KIND_ORDER as string[]).includes(k));
  return kinds.length > 0 ? new Set(kinds) : null;
}

function parseMultParam(raw: string | null): [number, number] | null {
  if (raw === null) return null;
  const [lo, hi] = raw.split('-').map(Number);
  return Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi ? [lo, hi] : null;
}

function rungKinds(row: PayoutFilterableRow): PayoutKind[] {
  const set = new Set<PayoutKind>();
  for (const v of row.variants ?? []) set.add(payoutKind(v.oddsType));
  return [...set];
}

function nearest(rungs: ProvidedVariant[], to: number): ProvidedVariant {
  return rungs.reduce((best, r) => (Math.abs(r.line - to) < Math.abs(best.line - to) ? r : best));
}

export interface BoardPayoutFilter<T extends PayoutFilterableRow = PayoutFilterableRow> {
  /** Kinds present across the board (for the chip options), in display order.
   *  Chips are worth showing when there are 2+ (i.e. the book has variants). */
  kindOptions: PayoutKind[];
  /** Currently-selected kinds. */
  selectedKinds: Set<PayoutKind>;
  toggleKind: (k: PayoutKind) => void;
  /** True when any rung posts a numeric multiplier (Underdog) → show the range. */
  hasMult: boolean;
  /** Full data bounds + the active [min,max] window over alternate multipliers. */
  multBounds: [number, number];
  multRange: [number, number];
  setMultRange: (r: [number, number]) => void;
  /** Rows after the payout filter. */
  rows: T[];
  /** Per `${slug}:${stat}` → the rung line to open the row on (when it differs from the
   *  server representative), so a filtered row shows its selected-kind/in-range rung. */
  initialLines: Map<string, number>;
  /** True when the filter is doing something (for a "clear" affordance). */
  active: boolean;
}

/** Board payout filtering (variant-kind multiselect + Underdog multiplier range). Pure
 *  over the already-fetched rows — no refetch here; the row card recomputes lazily if
 *  its opening rung differs from the server one. */
export function useBoardPayoutFilter<T extends PayoutFilterableRow>(rows: T[]): BoardPayoutFilter<T> {
  const kindOptions = useMemo(() => {
    const present = new Set<PayoutKind>();
    for (const r of rows) for (const k of rungKinds(r)) present.add(k);
    return KIND_ORDER.filter((k) => present.has(k));
  }, [rows]);
  const hasKinds = kindOptions.length >= 2;

  const hasMult = useMemo(
    () =>
      rows.some((r) =>
        (r.variants ?? []).some(
          (v) => payoutKind(v.oddsType) === 'alternate' && v.multiplier != null,
        ),
      ),
    [rows],
  );

  const multBounds = useMemo<[number, number]>(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows)
      for (const v of r.variants ?? [])
        if (payoutKind(v.oddsType) === 'alternate' && v.multiplier != null) {
          lo = Math.min(lo, v.multiplier);
          hi = Math.max(hi, v.multiplier);
        }
    return Number.isFinite(lo) ? [lo, hi] : [1, 1];
  }, [rows]);

  // `null` = "not narrowed yet" so the defaults track the current book's data.
  const [selected, setSelected] = useState<Set<PayoutKind> | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const hydrated = useRef(false);

  // Hydrate a narrowed filter from the URL once on mount (after hydration, so SSR
  // and the first client render agree), then mirror every change back into the URL
  // with replaceState — leaving all other params (and history) untouched.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const k = parseKindsParam(params.get(KINDS_PARAM));
    const m = parseMultParam(params.get(MULT_PARAM));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (k) setSelected(k);
    if (m) setRange(m);
    hydrated.current = true;
  }, []);

  // The DEFAULT selection is Standard only — every page opens on the plain lines,
  // and demons/goblins/alternates are an explicit opt-in (a book with no standard
  // lines at all falls back to everything it has).
  const defaultKinds = useMemo(
    () => new Set<PayoutKind>(kindOptions.includes('normal') ? ['normal'] : kindOptions),
    [kindOptions],
  );
  const setsEqual = (a: Set<PayoutKind>, b: Set<PayoutKind>) =>
    a.size === b.size && [...a].every((k) => b.has(k));

  // Intersect the saved picks with what the CURRENT book offers — switching books
  // (PrizePicks → Underdog) must never strand the board on a kind that no longer
  // exists. An empty intersection falls back to the standard-only default.
  const selectedKinds = useMemo(() => {
    if (!selected) return defaultKinds;
    const inter = new Set(kindOptions.filter((k) => selected.has(k)));
    return inter.size > 0 ? inter : defaultKinds;
  }, [selected, kindOptions, defaultKinds]);

  useEffect(() => {
    if (!hydrated.current) return;
    const params = new URLSearchParams(window.location.search);
    if (selected && !setsEqual(selectedKinds, defaultKinds))
      params.set(KINDS_PARAM, KIND_ORDER.filter((k) => selectedKinds.has(k)).join(','));
    else params.delete(KINDS_PARAM);
    if (range && (range[0] !== multBounds[0] || range[1] !== multBounds[1]))
      params.set(MULT_PARAM, `${parseFloat(range[0].toFixed(2))}-${parseFloat(range[1].toFixed(2))}`);
    else params.delete(MULT_PARAM);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [selected, selectedKinds, range, defaultKinds, multBounds]);
  const multRange = useMemo<[number, number]>(() => {
    if (!range) return multBounds;
    const lo = Math.min(Math.max(range[0], multBounds[0]), multBounds[1]);
    const hi = Math.max(Math.min(range[1], multBounds[1]), lo);
    return [lo, hi];
  }, [range, multBounds]);
  const rangeNarrowed = multRange[0] !== multBounds[0] || multRange[1] !== multBounds[1];

  const toggleKind = (k: PayoutKind) => {
    setSelected((prev) => {
      const base = prev ?? defaultKinds;
      const next = new Set(base);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      // Never let the board go fully empty via the filter — the default is the floor.
      return next.size === 0 ? defaultKinds : next;
    });
  };

  const { filtered, initialLines } = useMemo(() => {
    const initialLines = new Map<string, number>();
    if (!hasKinds && !hasMult) return { filtered: rows, initialLines };

    // An alternate rung qualifies only inside the multiplier window (when narrowed);
    // other kinds are never range-gated.
    const [lo, hi] = multRange;
    const eligible = (v: ProvidedVariant, kind: PayoutKind) =>
      kind !== 'alternate' ||
      !rangeNarrowed ||
      (v.multiplier != null && v.multiplier >= lo - 1e-9 && v.multiplier <= hi + 1e-9);

    // Narrowing the multiplier window is an explicit ask for alternates — surface the
    // in-range alternate rung first, falling back to the other selected kinds for rows
    // without one (deselect Standard to keep only in-range alternates).
    const order: PayoutKind[] = rangeNarrowed
      ? ['alternate', 'normal', 'demon', 'goblin']
      : KIND_ORDER;

    const out: T[] = [];
    const chosenScore = new Map<T, number>();
    for (const r of rows) {
      const variants = r.variants ?? [];
      // Highest-priority selected kind the row actually has → its nearest rung.
      let chosen: ProvidedVariant | null = null;
      for (const k of order) {
        if (!selectedKinds.has(k)) continue;
        const rungs = variants.filter((v) => payoutKind(v.oddsType) === k && eligible(v, k));
        if (rungs.length) {
          chosen = nearest(rungs, r.line);
          break;
        }
      }
      if (!chosen) continue; // row has no qualifying rung of any selected kind → hide
      // A special rung with a genuinely zero read isn't worth surfacing in a
      // variant-focused cut (standard lines keep the explorers' own gate).
      if (chosen.read && chosen.read.score <= 0 && payoutKind(chosen.oddsType) !== 'normal') continue;
      out.push(r);
      if (chosen.read) chosenScore.set(r, chosen.read.score);
      if (chosen.line !== r.line) initialLines.set(`${r.player.slug}:${r.stat}`, chosen.line);
    }
    // Rank by the rung each row will actually SHOW — with the standard-only default
    // this equals the server's order; a demon/goblin cut re-ranks by those rungs'
    // reads. No-op when rungs carry no reads (trend rows): the sort keys all tie and
    // the incoming order is kept (Array#sort is stable).
    if (chosenScore.size > 0) {
      out.sort((a, b) => (chosenScore.get(b) ?? -1) - (chosenScore.get(a) ?? -1));
    }
    return { filtered: out, initialLines };
  }, [rows, hasKinds, hasMult, selectedKinds, multRange, rangeNarrowed]);

  const active = (hasKinds && !setsEqual(selectedKinds, defaultKinds)) || (hasMult && rangeNarrowed);

  return {
    kindOptions,
    selectedKinds,
    toggleKind,
    hasMult,
    multBounds,
    multRange,
    setMultRange: (r) => setRange(r),
    rows: filtered,
    initialLines,
    active,
  };
}
