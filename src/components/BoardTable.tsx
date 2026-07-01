import type { BoardRow } from '@/lib/types';
import type { PayoutKind } from '@/lib/payoutVariant';
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
  enabledKinds,
  showSport = false,
}: {
  rows: BoardRow[];
  /** Book the shown board belongs to — needed for a row's on-click FireFactor recompute. */
  source?: string;
  /** Per `${slug}:${stat}` opening rung from the payout filter (remounts the row). */
  initialLines?: Map<string, number>;
  /** Kinds the payout filter has selected — hides chips of de-selected kinds. */
  enabledKinds?: Set<PayoutKind>;
  /** Add a league chip per row for the cross-sport ("All") board. */
  showSport?: boolean;
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => {
        const initialLine = initialLines?.get(`${r.player.slug}:${r.stat}`);
        return (
          <BoardRowCard
            key={`${r.player.sport}-${r.player.slug}-${r.stat}-${initialLine ?? 'def'}`}
            sport={r.player.sport}
            row={r}
            source={source}
            initialLine={initialLine}
            enabledKinds={enabledKinds}
            showSport={showSport}
          />
        );
      })}
    </ol>
  );
}
