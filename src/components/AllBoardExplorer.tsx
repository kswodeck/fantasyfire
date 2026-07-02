'use client';

import { useMemo, useState } from 'react';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';
import { BoardPayoutControls } from './BoardPayoutControls';
import { useBoardPayoutFilter } from './useBoardPayoutFilter';
import { useSourced } from './useSourced';
import { bestVariantScore } from '@/lib/payoutVariant';
import { normalizeName } from '@/lib/slate';

const STEP = 25;

/**
 * The cross-sport ("All Sports") Heat Check board: every active league's reads merged
 * and ranked together by FireFactor, with a per-row league chip. Keeps the shared book
 * selector (a book just contributes the sports it lists) and the payout-variant filter
 * (PrizePicks demons/goblins, Underdog alternates + multiplier range). Name search +
 * "show more" only — team/position filters are sport-specific, so they live on the
 * per-sport pages.
 */
export function AllBoardExplorer({
  boardsBySource,
  sources,
  defaultSource,
  medianRows,
}: {
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
  medianRows: BoardRow[];
}) {
  const hasSources = sources.length > 0;
  const sourced = useSourced(boardsBySource, sources, defaultSource);
  // Drop rows with no read anywhere — neither the shown line nor any scored rung
  // clears 0 (0 = coin flip on a standard line, fairly-priced on a variant).
  const rows = (hasSources ? sourced.rows : medianRows).filter(
    (r) => bestVariantScore(r.fireScore.score, r.variants) > 0,
  );

  // Payout filter (variant kinds / Underdog multiplier range) over the current book.
  const payout = useBoardPayoutFilter(rows);

  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(STEP);
  const nq = normalizeName(query);
  const filtered = useMemo(
    () =>
      nq === ''
        ? payout.rows
        : payout.rows.filter((r) => normalizeName(r.player.fullName).includes(nq)),
    [payout.rows, nq],
  );
  const shown = filtered.slice(0, visible);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          aria-label="Search players by name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(STEP);
          }}
          placeholder="Search players…"
          className="w-44 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
        {hasSources && (
          <SourceSelector
            sources={sourced.liveSources}
            value={sourced.source}
            onChange={sourced.setSource}
          />
        )}
      </div>

      {hasSources && (payout.kindOptions.length >= 2 || payout.hasMult) && (
        <div className="mb-4">
          <BoardPayoutControls filter={payout} />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No reads match right now.
        </p>
      ) : (
        <>
          <BoardTable
            rows={shown}
            source={hasSources ? sourced.source : undefined}
            initialLines={payout.initialLines}
            enabledKinds={payout.enabledKinds}
            showSport
          />
          {visible < filtered.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + STEP)}
              className="mt-3 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-brand transition-colors hover:bg-surface-2"
            >
              Show more ({filtered.length - visible} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
