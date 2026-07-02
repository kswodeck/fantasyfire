'use client';

import type { BoardPayoutFilter } from './useBoardPayoutFilter';
import type { PayoutKind } from '@/lib/payoutVariant';
import { PayoutGlyph, formatMultiplier } from './PayoutBadge';

const KIND_LABEL: Record<PayoutKind, string> = {
  normal: 'Standard',
  demon: 'Demons',
  goblin: 'Goblins',
  alternate: 'Alternates',
};

/** Board payout filter controls: a variant-kind multiselect (Standard / Demons /
 *  Goblins / Alternates — whatever the book offers) plus a multiplier min/max when
 *  the book posts numeric multipliers (Underdog — standard lines carry them too).
 *  Renders nothing for a plain book with no variants. */
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
      {showKinds && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Show</span>
          {filter.kindOptions.map((k) => {
            const on = filter.selectedKinds.has(k);
            const tone = !on
              ? 'border-line text-muted hover:text-foreground'
              : k === 'demon'
                ? 'border-demon/40 bg-demon/12 text-demon'
                : k === 'goblin'
                  ? 'border-goblin/40 bg-goblin/12 text-goblin'
                  : k === 'alternate'
                    ? 'border-heat-1/40 bg-heat-1/12 text-heat-1'
                    : 'border-brand bg-brand/10 text-foreground';
            return (
              <button
                key={k}
                type="button"
                onClick={() => filter.toggleKind(k)}
                aria-pressed={on}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${tone}`}
              >
                {(k === 'demon' || k === 'goblin') && <PayoutGlyph kind={k} size={12} />}
                {KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      )}

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
