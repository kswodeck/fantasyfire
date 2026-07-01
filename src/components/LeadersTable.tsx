import Link from 'next/link';
import type { LeaderRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { getTeam } from '@/lib/teams';
import { num1 } from '@/lib/format';
import { PlayerAvatar } from './PlayerAvatar';
import { InjuryBadge } from './InjuryBadge';

/** Ranked season per-game leaders for a stat. */
export function LeadersTable({
  sport,
  rows,
  unit,
}: {
  sport: Sport;
  rows: LeaderRow[];
  unit: string;
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => {
        const team = getTeam(sport, r.player.teamAbbreviation);
        return (
          <li key={r.player.slug}>
            <Link
              href={`/${sport}/${r.player.slug}`}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2"
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">
                {r.rank}
              </span>
              <PlayerAvatar
                sport={sport}
                externalId={r.player.externalId}
                name={r.player.fullName}
                size={36}
                ring={team.primary}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {r.player.fullName}
                  </span>
                  <InjuryBadge injury={r.player.availability} />
                </div>
                <div className="truncate text-xs text-muted">
                  {[r.player.teamAbbreviation, r.player.position]
                    .filter(Boolean)
                    .join(' · ')}{' '}
                  · {r.gamesPlayed} games
                </div>
              </div>
              <div className="shrink-0 text-right text-sm font-bold tabular-nums">
                {num1(r.perGame)}{' '}
                <span className="text-xs font-normal text-muted">{unit}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
