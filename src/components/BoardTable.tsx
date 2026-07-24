import type { BoardRow } from '@/lib/types';
import { BoardRowCard } from './BoardRowCard';

/**
 * Ranked cross-player board (presentational). Each row links to the player page with
 * the stat + line preselected, and — when its source offers payout variants — carries
 * an inline demon/goblin/alternate switcher (see BoardRowCard). Sport is read per-row
 * (r.player.sport), so this renders single-sport or mixed-sport boards alike; `showSport`
 * adds a league chip for the cross-sport ("All") view. `source` is the book the shown
 * board belongs to, needed for a row's on-click FireFactor recompute.
 */
export function BoardTable({
  rows,
  source,
  initialLines,
  showSport = false,
  reserveLineValue = false,
  reserveSpecial = false,
}: {
  rows: BoardRow[];
  /** Book the shown board belongs to — needed for a row's on-click FireFactor recompute. */
  source?: string;
  /** Per `${slug}:${stat}` opening rung from the payout filter (remounts the row). */
  initialLines?: Map<string, number>;
  /** Add a league chip per row for the cross-sport ("All") board. */
  showSport?: boolean;
  /** Reserve a uniform line of space across ALL rows for the line-value / best-payout
   *  hints, so a set of rows stays equal height when only some carry a hint (none is
   *  dropped). The caller sets each when any row in the set has that hint — see
   *  BoardRowCard. Used by the home teaser to keep sport cards flush. */
  reserveLineValue?: boolean;
  reserveSpecial?: boolean;
}) {
  return (
    <ol
      aria-label="Ranked player prop reads"
      className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface"
    >
      {rows.map((r) => {
        const initialLine = initialLines?.get(`${r.player.slug}:${r.stat}`);
        return (
          <BoardRowCard
            key={`${r.player.sport}-${r.player.slug}-${r.stat}-${initialLine ?? 'def'}`}
            sport={r.player.sport}
            row={r}
            source={source}
            initialLine={initialLine}
            showSport={showSport}
            reserveLineValue={reserveLineValue}
            reserveSpecial={reserveSpecial}
          />
        );
      })}
    </ol>
  );
}
