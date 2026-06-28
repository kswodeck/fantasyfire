'use client';

import { useMemo, useState } from 'react';
import type { TrendRow } from '@/lib/types';
import { TrendBoardTable } from './TrendBoardTable';
import { SourceSelector } from './SourceSelector';
import { useSourced } from './useSourced';
import { normalizeName } from '@/lib/slate';

const STEP = 50;

/**
 * Cross-sport ("All Sports") Trends board: every active league's form swings merged and
 * ranked together by the Wilson lower bound, with a per-row league chip. Keeps the book
 * selector; name search + "show more" only (team/position filters are per-sport).
 */
export function AllTrendsExplorer({
  bySource,
  sources,
  defaultSource,
  medianRows,
}: {
  bySource: Record<string, TrendRow[]>;
  sources: string[];
  defaultSource: string;
  medianRows: TrendRow[];
}) {
  const hasSources = sources.length > 0;
  const sourced = useSourced(bySource, sources, defaultSource);
  const rows = hasSources ? sourced.rows : medianRows;

  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(STEP);
  const nq = normalizeName(query);
  const filtered = useMemo(
    () =>
      nq === ''
        ? rows
        : rows.filter((r) => normalizeName(r.player.fullName).includes(nq)),
    [rows, nq],
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

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No trends match right now.
        </p>
      ) : (
        <>
          <TrendBoardTable rows={shown} showSport />
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
