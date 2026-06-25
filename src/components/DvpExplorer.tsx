'use client';

import { useState } from 'react';
import type { DvpTableRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { DvpTable } from './DvpTable';

interface Opt {
  value: string;
  label: string;
}

/** Stat (+ position for NBA/NFL) picker over pre-fetched DvP tables — switches in memory. */
export function DvpExplorer({
  sport,
  tables,
  stats,
  positions,
  unitByStat,
  statsByPosition,
}: {
  sport: Sport;
  tables: Record<string, DvpTableRow[]>;
  stats: Opt[];
  positions: Opt[];
  unitByStat: Record<string, string>;
  /** NFL: which stat keys apply to each position (so a WR never lists pass yards). */
  statsByPosition?: Record<string, string[]>;
}) {
  const [pos, setPos] = useState(positions[0]?.value ?? '');
  // For position-specific sports (NFL) the stat list follows the selected
  // position; otherwise every stat applies to every position (NBA/MLB).
  const statsForPos = (p: string): Opt[] =>
    statsByPosition ? stats.filter((s) => statsByPosition[p]?.includes(s.value)) : stats;
  const availStats = statsForPos(pos);
  const [stat, setStat] = useState(availStats[0]?.value ?? '');
  const rows = tables[`${stat}:${pos}`] ?? [];
  const selectCls =
    'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-brand';

  function onPos(next: string) {
    setPos(next);
    const valid = statsForPos(next);
    if (!valid.some((s) => s.value === stat)) setStat(valid[0]?.value ?? '');
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {positions.length > 1 && (
          <select
            aria-label="Position"
            value={pos}
            onChange={(e) => onPos(e.target.value)}
            className={selectCls}
          >
            {positions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Stat"
          value={stat}
          onChange={(e) => setStat(e.target.value)}
          className={selectCls}
        >
          {availStats.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">Rank 1 = allows the most (softest)</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No matchup data for this selection yet.
        </p>
      ) : (
        <DvpTable sport={sport} rows={rows} unit={unitByStat[stat] ?? ''} />
      )}
    </div>
  );
}
