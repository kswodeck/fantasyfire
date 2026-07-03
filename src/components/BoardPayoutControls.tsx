'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { BoardPayoutFilter } from './useBoardPayoutFilter';
import type { PayoutKind } from '@/lib/payoutVariant';
import { PayoutGlyph, formatMultiplier } from './PayoutBadge';

const KIND_LABEL: Record<PayoutKind, string> = {
  normal: 'Standard',
  demon: 'Demons',
  goblin: 'Goblins',
  alternate: 'Alternates',
};

/** The kind dropdown's button caption: the first selected kind, "+N" for the rest. */
function kindSummary(options: PayoutKind[], selected: Set<PayoutKind>): string {
  const picked = options.filter((k) => selected.has(k));
  if (picked.length === 0) return 'None';
  const first = KIND_LABEL[picked[0]];
  return picked.length === 1 ? first : `${first} +${picked.length - 1}`;
}

/** Variant-kind multiselect as a compact dropdown of checkboxes (Standard / Demons /
 *  Goblins / Alternates — whatever the book offers). Default is Standard only; the
 *  dropdown replaces the old chip row to keep the filter bar to one control. */
function KindMenu({ filter }: { filter: BoardPayoutFilter }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside click / Escape — standard popover hygiene.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2 text-xs">
      <span className="text-muted">Lines</span>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
      >
        {kindSummary(filter.kindOptions, filter.selectedKinds)}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl shadow-black/40"
        >
          {filter.kindOptions.map((k) => {
            const on = filter.selectedKinds.has(k);
            const tone =
              k === 'demon' ? 'text-demon' : k === 'goblin' ? 'text-goblin' : k === 'alternate' ? 'text-heat-1' : '';
            return (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => filter.toggleKind(k)}
                  className="h-3.5 w-3.5 accent-brand"
                />
                <span className={`inline-flex items-center gap-1.5 font-medium ${tone}`}>
                  {(k === 'demon' || k === 'goblin') && <PayoutGlyph kind={k} size={12} />}
                  {KIND_LABEL[k]}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Board payout filter controls: the variant-kind dropdown multiselect plus a
 *  multiplier min/max when the book posts numeric multipliers (Underdog — standard
 *  lines carry them too). Renders nothing for a plain book with no variants. */
export function BoardPayoutControls({ filter }: { filter: BoardPayoutFilter }) {
  const showKinds = filter.kindOptions.length >= 2;
  const showMult = filter.hasMult;
  if (!showKinds && !showMult) return null;

  const [lo, hi] = filter.multBounds;
  const multActive = filter.multMin !== null || filter.multMax !== null;
  // Empty input = unbounded on that side; anything unparseable clears the bound.
  const parseBound = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {showKinds && <KindMenu filter={filter} />}

      {/* Multiplier min/max over EVERY rung's multiplier (Underdog posts one on
          standard lines too). Empty = unbounded; both empty (the default) = off.
          While set, rows without an in-range multiplier are hidden and each row
          opens at its best in-range rung — regardless of the Show selection. */}
      {showMult && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Multiplier</span>
          <input
            type="number"
            value={filter.multMin ?? ''}
            placeholder="min"
            min={0}
            step={0.05}
            onChange={(e) => filter.setMultMin(parseBound(e.target.value))}
            aria-label="Minimum payout multiplier (empty for no minimum)"
            className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-right tabular-nums text-foreground placeholder:text-muted"
          />
          <span>–</span>
          <input
            type="number"
            value={filter.multMax ?? ''}
            placeholder="max"
            min={0}
            step={0.05}
            onChange={(e) => filter.setMultMax(parseBound(e.target.value))}
            aria-label="Maximum payout multiplier (empty for no maximum)"
            className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-right tabular-nums text-foreground placeholder:text-muted"
          />
          <span className="text-[11px]">
            ({formatMultiplier(lo)}–{formatMultiplier(hi)} available)
          </span>
          {multActive && (
            <button
              type="button"
              onClick={() => {
                filter.setMultMin(null);
                filter.setMultMax(null);
              }}
              className="cursor-pointer font-medium text-brand hover:text-brand-strong"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
