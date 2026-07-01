import type { BoardRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { BoardRowCard } from './BoardRowCard';

/**
 * Ranked cross-player board (presentational). Each row links to the player page with
 * the stat + line preselected, and — when its source offers payout variants — carries
 * an inline demon/goblin/alternate switcher (see BoardRowCard). `source` is the book
 * the shown board belongs to, needed for the row's on-click FireFactor recompute.
 */
export function BoardTable({
  sport,
  rows,
  source,
  initialLines,
}: {
  sport: Sport;
  rows: BoardRow[];
  source?: string;
  /** Per `${slug}:${stat}` opening rung from the payout filter (remounts the row). */
  initialLines?: Map<string, number>;
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => {
        const initialLine = initialLines?.get(`${r.player.slug}:${r.stat}`);
        return (
          <BoardRowCard
            key={`${r.player.slug}-${r.stat}-${initialLine ?? 'def'}`}
            sport={sport}
            row={r}
            source={source}
            initialLine={initialLine}
          />
        );
      })}
    </ol>
  );
}
