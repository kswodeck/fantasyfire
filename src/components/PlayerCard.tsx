import Link from 'next/link';
import type { PlayerListItem } from '@/lib/types';
import { getTeam } from '@/lib/teams';
import { PlayerAvatar } from './PlayerAvatar';
import { TeamLogo } from './TeamLogo';
import { InjuryBadge } from './InjuryBadge';

/** Compact, linkable player card: headshot + team-color accent + logo + games. */
export function PlayerCard({ player }: { player: PlayerListItem }) {
  const team = getTeam(player.sport, player.teamAbbreviation);
  return (
    <Link
      href={`/${player.sport}/${player.slug}`}
      className="flex items-center gap-3 rounded-xl border border-l-4 border-line bg-surface p-3 transition-colors hover:bg-surface-2"
      style={{ borderLeftColor: team.primary }}
    >
      <PlayerAvatar
        sport={player.sport}
        externalId={player.externalId}
        name={player.fullName}
        size={44}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{player.fullName}</span>
          <InjuryBadge injury={player.availability} />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <TeamLogo
            sport={player.sport}
            externalId={player.teamExternalId}
            abbr={player.teamAbbreviation}
            size={14}
          />
          <span className="truncate">
            {[player.teamAbbreviation, player.position].filter(Boolean).join(' · ') ||
              'Free agent'}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted">
        {player.gamesPlayed} {player.gamesPlayed === 1 ? 'game' : 'games'}
      </div>
    </Link>
  );
}
