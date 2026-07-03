'use client';

import { useMemo, useState } from 'react';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';
import { BoardPayoutControls } from './BoardPayoutControls';
import { useBoardPayoutFilter } from './useBoardPayoutFilter';
import { useSourced } from './useSourced';
import { useSelectedSlate } from './SelectedSlateProvider';
import { SlateSwitch } from './SlateSwitch';
import type { LeanFilter } from './useListFilter';
import { bestVariantScore } from '@/lib/payoutVariant';
import { FIREFACTOR_TIER_CUTOFFS } from '@/lib/stats';
import { normalizeName } from '@/lib/slate';

const STEP = 25;

/**
 * The cross-sport ("All Sports") Heat Check board: every active league's reads merged
 * and ranked together by FireFactor, with a per-row league chip. Keeps the shared book
 * selector (a book just contributes the sports it lists), the site-synced "Today only"
 * switch (each row checks its own sport's slate), the payout-variant filter
 * (PrizePicks demons/goblins, Underdog alternates + multiplier range), and a lean
 * (Over / Under) select. Name search + "show more" only — team/position filters are
 * sport-specific, so they live on the per-sport pages.
 */
export function AllBoardExplorer({
  boardsBySource,
  sources,
  defaultSource,
  medianRows,
  todayTeamsBySport = {},
}: {
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
  medianRows: BoardRow[];
  /** Teams on each sport's current slate (today; this week for NFL). */
  todayTeamsBySport?: Record<string, string[]>;
}) {
  const hasSources = sources.length > 0;
  const sourced = useSourced(boardsBySource, sources, defaultSource);
  // Keep rows where SOME line (shown or any scored rung) reaches at least a faint
  // read — chance-floored single digits are "almost certainly not" territory and
  // would flood the board with noise.
  const rows = (hasSources ? sourced.rows : medianRows).filter(
    (r) => bestVariantScore(r.fireScore.score, r.variants) >= FIREFACTOR_TIER_CUTOFFS.none,
  );

  // "Today only" (site-synced, default on) — a row is on the slate when its player's
  // team appears under its OWN sport's slate teams. No slate data → always all.
  const hasSlate = Object.keys(todayTeamsBySport).length > 0;
  const { mode, setMode } = useSelectedSlate();
  const effectiveMode = hasSlate ? mode : 'all';
  const teamSets = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [sport, teams] of Object.entries(todayTeamsBySport)) m.set(sport, new Set(teams));
    return m;
  }, [todayTeamsBySport]);
  const slateRows =
    effectiveMode === 'all'
      ? rows
      : rows.filter(
          (r) =>
            r.player.teamAbbreviation != null &&
            teamSets.get(r.player.sport)?.has(r.player.teamAbbreviation) === true,
        );

  // Payout filter (variant kinds / Underdog multiplier range) over the current book.
  const payout = useBoardPayoutFilter(slateRows);

  const [query, setQuery] = useState('');
  const [lean, setLean] = useState<LeanFilter>('');
  const [visible, setVisible] = useState(STEP);
  const nq = normalizeName(query);
  const filtered = useMemo(
    () =>
      payout.rows.filter(
        (r) =>
          (nq === '' || normalizeName(r.player.fullName).includes(nq)) &&
          (lean === '' || r.fireScore.side === lean),
      ),
    [payout.rows, nq, lean],
  );
  const shown = filtered.slice(0, visible);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {hasSlate ? (
          <SlateSwitch
            on={mode === 'today'}
            onChange={(on) => setMode(on ? 'today' : 'all')}
            label="Today only"
          />
        ) : (
          <span />
        )}
        {hasSources && (
          <SourceSelector
            sources={sourced.liveSources}
            value={sourced.source}
            onChange={sourced.setSource}
          />
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search players by name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(STEP);
          }}
          placeholder="Search players…"
          className="w-40 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand sm:w-44"
        />
        <select
          aria-label="Filter by lean direction"
          value={lean}
          onChange={(e) => {
            setLean(e.target.value as LeanFilter);
            setVisible(STEP);
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
        >
          <option value="">All leans</option>
          <option value="over">Over</option>
          <option value="under">Under</option>
        </select>
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
