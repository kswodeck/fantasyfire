'use client';

import type { BoardRow } from '@/lib/types';
import { STAT_DEFS, type StatKey } from '@/lib/stats';
import { heatLabel, tierTextClass, leanTextClass } from '@/lib/tierStyle';
import { LeanArrow } from './LeanArrow';
import { PayoutBadge } from './PayoutBadge';

/**
 * The player page's "top reads" mini dashboard — this player's strongest
 * prop+line combos for the next matchup, board-identical scoring, ranked by
 * FireFactor. Each row is a button: picking one loads that prop/line into the
 * whole page (stat selector, line, ladder, verdict, charts all follow), exactly
 * as if it had been selected by hand. Renders nothing when there are no real
 * leans (thin history, everything grades a Pass, or the player is unknown).
 */
export function PlayerTopReads({
  rows,
  currentStat,
  currentLine,
  onPick,
}: {
  rows: BoardRow[] | undefined;
  currentStat: StatKey;
  currentLine: number;
  onPick: (
    stat: StatKey,
    line: number,
    /** The pick's payout context, so the loaded read scores against it even if the
     *  book moves the rung before the refetch lands (see RungHint). */
    hint?: { oddsType?: string | null; multiplier?: number | null },
  ) => void;
}) {
  if (!rows || rows.length === 0) return null;
  return (
    <section
      aria-label="Top reads for this player"
      className="mb-5 rounded-xl border border-line bg-surface-2 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-sm font-semibold">Top reads — this player &amp; matchup</h2>
        <span className="text-[11px] text-muted">pick one to load it below</span>
      </div>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {rows.map((r) => {
          const { side, tier, score } = r.fireScore;
          const active = r.stat === currentStat && r.line === currentLine;
          return (
            <li key={`${r.stat}:${r.line}`}>
              <button
                type="button"
                onClick={() => onPick(r.stat, r.line, { oddsType: r.oddsType, multiplier: r.multiplier })}
                aria-pressed={active}
                title={STAT_DEFS[r.stat].label}
                className={
                  'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ' +
                  (active
                    ? 'border-brand bg-brand/10'
                    : 'border-line bg-surface hover:border-brand/60')
                }
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={leanTextClass(side)}>{side === 'over' ? 'Over' : 'Under'}</span>
                  <span className="font-medium tabular-nums">{r.line}</span>
                  <span className="truncate text-muted">{r.statShort}</span>
                  <PayoutBadge oddsType={r.oddsType} multiplier={r.multiplier} showLabel={false} />
                </span>
                <span
                  className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${tierTextClass(tier, side)}`}
                >
                  <LeanArrow tier={tier} side={side} decorative />
                  {heatLabel(tier, side)}
                  <span className="font-normal text-muted tabular-nums">FF {score}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        Ranked by FireFactor for the next matchup, straight from the game logs.
      </p>
    </section>
  );
}
