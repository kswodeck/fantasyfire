'use client';

import type { ProvidedVariant } from '@/lib/types';
import { PayoutBadge, formatMultiplier } from './PayoutBadge';
import { payoutKind } from '@/lib/payoutVariant';
import { overRateAt } from '@/lib/stats';
import { pct } from '@/lib/format';
import { sourceLabel } from '@/lib/providedSources';
import { PP_POWER_PLAY, PP_FLEX_PLAY, PP_DEMON_RULE, PP_GOBLIN_RULE } from '@/lib/ppPayouts';

/**
 * The full payout-variant ladder for the selected book (PrizePicks standard/demon/
 * goblin rungs or Underdog balanced + alternates). Each rung is selectable; picking one
 * drives the same line-change recompute the line input does, so the FireFactor /
 * verdict update to the chosen rung. Every rung is annotated with the player's season
 * over rate at that number, and — when the book posts an exact multiplier (Underdog) —
 * a payout-weighted rate (over rate × multiplier) for a per-leg comparison against the
 * 1× standard line. Renders nothing unless the book offers more than one rung.
 */
export function VariantLadder({
  variants,
  selectedLine,
  statShort,
  sourceId,
  onSelect,
  seasonValues = [],
}: {
  variants: ProvidedVariant[];
  selectedLine: number;
  statShort: string;
  sourceId: string;
  onSelect: (line: number) => void;
  /** Per-game season values for the current stat — powers the per-rung over rate.
   *  [] hides the annotations (the ladder still switches lines). */
  seasonValues?: number[];
}) {
  if (!variants || variants.length < 2) return null;
  const sorted = [...variants].sort((a, b) => a.line - b.line);
  const hasValues = seasonValues.length > 0;
  const anyMult = sorted.some((v) => v.multiplier != null);

  return (
    <div className="mb-5 rounded-xl border border-line bg-surface-2 p-4">
      <h3 className="text-sm font-semibold">{sourceLabel(sourceId)} payout options</h3>
      <p className="mb-3 mt-1 text-xs text-muted">
        Pick any line — standard, <span className="font-medium text-demon">demon</span>{' '}
        (harder, pays more), <span className="font-medium text-goblin">goblin</span>{' '}
        (easier, pays less), or an alternate with its payout multiplier — and the whole
        read updates to it. Only the standard line takes an under; every other variant
        pays the over only.
        {anyMult && hasValues && (
          <>
            {' '}
            <span className="font-medium text-foreground">Payout-wt</span> = season over
            rate × the rung&rsquo;s multiplier — a per-leg comparison against the
            standard line&rsquo;s 1×. Descriptive research, not betting advice.
          </>
        )}
      </p>
      <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {sorted.map((v) => {
          const active = v.line === selectedLine;
          const kind = payoutKind(v.oddsType);
          const { rate, overs, decided } = hasValues
            ? overRateAt(seasonValues, v.line)
            : { rate: null, overs: 0, decided: 0 };
          // Per-leg payout weight: only meaningful with an exact multiplier. The
          // standard line counts as 1× so the comparison has its baseline.
          const mult = v.multiplier ?? (anyMult && kind === 'normal' ? 1 : null);
          const weighted = rate !== null && mult !== null ? rate * mult : null;
          return (
            <li key={v.line}>
              <button
                type="button"
                onClick={() => onSelect(v.line)}
                aria-pressed={active}
                className={
                  'flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left text-sm transition-colors ' +
                  (active ? 'bg-brand/10' : 'hover:bg-surface-2')
                }
              >
                <span className={`tabular-nums font-semibold ${active ? 'text-brand' : ''}`}>{v.line}</span>
                <span className="text-xs text-muted">{statShort}</span>
                {rate !== null && (
                  <span className="text-[11px] tabular-nums text-muted" title={`${overs} of ${decided} decided games over ${v.line} (season)`}>
                    {pct(rate)} over
                  </span>
                )}
                {weighted !== null && (
                  <span
                    className="text-[11px] tabular-nums text-muted"
                    title={`Season over rate ${pct(rate)} × ${formatMultiplier(mult as number)} payout`}
                  >
                    · payout-wt <span className="font-medium text-foreground">{weighted.toFixed(2)}</span>
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {kind === 'normal' && (v.multiplier == null || v.multiplier === 1) ? (
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
      {sourceId === 'prizepicks' && (
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer font-medium text-foreground/80 transition-colors hover:text-foreground">
            How PrizePicks payouts work with demons & goblins
          </summary>
          <div className="mt-2 space-y-2">
            <p>
              Typical entry payouts (verify in the app — they change and can vary by
              state): Power Play {PP_POWER_PLAY.map((p) => `${p.picks}-pick ${p.pays}×`).join(', ')}.
              Flex Play{' '}
              {PP_FLEX_PLAY.map(
                (p) => `${p.picks}-pick ${p.allHit}×${p.twoMiss != null ? ` (${p.oneMiss}× / ${p.twoMiss}× on misses)` : ` (${p.oneMiss}× one miss)`}`,
              ).join(', ')}
              .
            </p>
            <p>
              <span className="font-medium text-demon">Demons:</span> {PP_DEMON_RULE}
            </p>
            <p>
              <span className="font-medium text-goblin">Goblins:</span> {PP_GOBLIN_RULE}
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
