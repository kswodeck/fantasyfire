'use client';

import type { Sport } from '@/lib/sports';
import type { BoardRow, TonightGame } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';
import { BoardPayoutControls } from './BoardPayoutControls';
import { useBoardPayoutFilter } from './useBoardPayoutFilter';
import { TeamLogo } from './TeamLogo';
import { useSourced } from './useSourced';

/**
 * The leans for a single game, split into the two teams and ranked by FireFactor within
 * each. Book selection comes from the shared, persisted selector (same as the board), so
 * switching books re-ranks both teams instantly, and the same payout-variant filter
 * (demons/goblins/alternates) applies across both teams. Rows are already filtered to
 * this game's two teams on the server; this just picks the book and groups them.
 */
export function GameLeans({
  sport,
  game,
  boardsBySource,
  sources,
  defaultSource,
  medianRows,
}: {
  sport: Sport;
  game: TonightGame;
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
  /** Fallback (median-line) rows for both teams, used when no book lines exist. */
  medianRows: BoardRow[];
}) {
  const hasSources = sources.length > 0;
  const sourced = useSourced(boardsBySource, sources, defaultSource);
  const allRows = hasSources ? sourced.rows : medianRows;
  // Below-cutoff rows ("No read") add noise on a per-game page — a reader wants the
  // matchup's genuine leans, not every line we looked at. The full universe stays
  // browsable on the board/player pages.
  const rows = allRows.filter(
    (r) => r.fireScore.tier !== 'Pass' && r.fireScore.tier !== 'No lean',
  );
  const payout = useBoardPayoutFilter(rows);

  return (
    <div>
      {hasSources && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <BoardPayoutControls filter={payout} />
          <SourceSelector
            sources={sourced.liveSources}
            value={sourced.source}
            onChange={sourced.setSource}
          />
        </div>
      )}
      {payout.rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No reads for this matchup on this book right now.
        </p>
      ) : (
        <div className="space-y-6">
          <TeamSection
            sport={sport}
            team={game.away}
            rows={payout.rows}
            source={hasSources ? sourced.source : undefined}
            initialLines={payout.initialLines}
          />
          <TeamSection
            sport={sport}
            team={game.home}
            rows={payout.rows}
            source={hasSources ? sourced.source : undefined}
            initialLines={payout.initialLines}
          />
        </div>
      )}
    </div>
  );
}

function TeamSection({
  sport,
  team,
  rows,
  source,
  initialLines,
}: {
  sport: Sport;
  team: TonightGame['home'];
  rows: BoardRow[];
  source?: string;
  initialLines?: Map<string, number>;
}) {
  const teamRows = rows.filter((r) => r.player.teamAbbreviation === team.abbr);
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <TeamLogo sport={sport} externalId={team.externalId} abbr={team.abbr} size={20} />
        <span>{team.name ?? team.abbr}</span>
        <span className="font-normal text-muted">
          · {teamRows.length} {teamRows.length === 1 ? 'read' : 'reads'}
        </span>
      </h2>
      {teamRows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          No qualifying reads for {team.abbr} on this book right now.
        </p>
      ) : (
        <BoardTable
          rows={teamRows}
          source={source}
          initialLines={initialLines}
        />
      )}
    </section>
  );
}
