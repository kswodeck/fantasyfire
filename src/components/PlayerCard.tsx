import Link from 'next/link';
import type { PlayerListItem } from '@/lib/types';

/** Compact, linkable player card for search results and the players index. */
export function PlayerCard({ player }: { player: PlayerListItem }) {
  return (
    <Link
      href={`/${player.slug}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand/50 hover:bg-surface-2"
    >
      <div className="min-w-0">
        <div className="truncate font-medium">{player.fullName}</div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {[player.teamAbbreviation, player.position].filter(Boolean).join(' · ') ||
            'Free agent'}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted">
        {player.gamesPlayed} {player.gamesPlayed === 1 ? 'game' : 'games'}
      </div>
    </Link>
  );
}
