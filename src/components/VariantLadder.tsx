'use client';

import type { ProvidedVariant } from '@/lib/types';
import { PayoutBadge } from './PayoutBadge';
import { payoutKind } from '@/lib/payoutVariant';
import { sourceLabel } from '@/lib/providedSources';

/**
 * The full payout-variant ladder for the selected book (PrizePicks demon/goblin rungs
 * or Underdog balanced + alternates). Each rung is selectable; picking one drives the
 * same line-change recompute the line input does, so the FireFactor / verdict update to
 * the chosen rung. Renders nothing unless the book offers more than one rung.
 */
export function VariantLadder({
  variants,
  selectedLine,
  statShort,
  sourceId,
  onSelect,
}: {
  variants: ProvidedVariant[];
  selectedLine: number;
  statShort: string;
  sourceId: string;
  onSelect: (line: number) => void;
}) {
  if (!variants || variants.length < 2) return null;
  const sorted = [...variants].sort((a, b) => a.line - b.line);

  return (
    <div className="mb-5 rounded-xl border border-line bg-surface-2 p-4">
      <h3 className="text-sm font-semibold">{sourceLabel(sourceId)} payout options</h3>
      <p className="mb-3 mt-1 text-xs text-muted">
        Pick a line to update the read. A{' '}
        <span className="font-medium text-demon">demon</span> is a harder line that pays more; a{' '}
        <span className="font-medium text-goblin">goblin</span> is an easier line that pays less.
      </p>
      <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {sorted.map((v) => {
          const active = v.line === selectedLine;
          const kind = payoutKind(v.oddsType);
          return (
            <li key={v.line}>
              <button
                type="button"
                onClick={() => onSelect(v.line)}
                aria-pressed={active}
                className={
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ' +
                  (active ? 'bg-brand/10' : 'hover:bg-surface-2')
                }
              >
                <span className={`tabular-nums font-semibold ${active ? 'text-brand' : ''}`}>{v.line}</span>
                <span className="text-xs text-muted">{statShort}</span>
                <span className="ml-auto flex items-center gap-2">
                  {kind === 'normal' ? (
                    <span className="text-[11px] text-muted">standard</span>
                  ) : (
                    <PayoutBadge oddsType={v.oddsType} multiplier={v.multiplier} showLabel />
                  )}
                  {active && <span className="text-[11px] font-medium text-brand">selected</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
