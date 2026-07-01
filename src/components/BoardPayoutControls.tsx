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

/** Board payout filter controls: PrizePicks type multiselect or a multiplier range,
 *  chosen by the current book (see useBoardPayoutFilter). Renders nothing for a plain
 *  book with no variants. */
export function BoardPayoutControls({ filter }: { filter: BoardPayoutFilter }) {
  if (filter.mode === 'none' || (filter.mode === 'type' && filter.kindOptions.length < 2)) return null;

  if (filter.mode === 'type') {
    return (
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
    );
  }

  // Multiplier range (Underdog alternates). Round bounds to a sensible step.
  const [lo, hi] = filter.multBounds;
  const [minV, maxV] = filter.multRange;
  const step = 0.05;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>Payout</span>
      <input
        type="number"
        value={parseFloat(minV.toFixed(2))}
        min={lo}
        max={maxV}
        step={step}
        onChange={(e) => filter.setMultRange([Math.max(lo, Number(e.target.value) || lo), maxV])}
        aria-label="Minimum payout multiplier"
        className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-right tabular-nums text-foreground"
      />
      <span>–</span>
      <input
        type="number"
        value={parseFloat(maxV.toFixed(2))}
        min={minV}
        max={hi}
        step={step}
        onChange={(e) => filter.setMultRange([minV, Math.min(hi, Number(e.target.value) || hi)])}
        aria-label="Maximum payout multiplier"
        className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-right tabular-nums text-foreground"
      />
      <span className="text-[11px]">
        ({formatMultiplier(lo)}–{formatMultiplier(hi)} available)
      </span>
    </div>
  );
}
