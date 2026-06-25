import Link from 'next/link';
import type { StreakRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { getTeam } from '@/lib/teams';
import { PlayerAvatar } from './PlayerAvatar';
import { LeanArrow } from './LeanArrow';

/** Ranked current-streak board. Over runs read green ↑, under runs red ↓. */
export function StreakBoardTable({ sport, rows }: { sport: Sport; rows: StreakRow[] }) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => {
        const team = getTeam(sport, r.player.teamAbbreviation);
        const sideCls = r.side === 'over' ? 'text-over' : 'text-under';
        return (
          <li key={`${r.player.slug}-${r.stat}`}>
            <Link
              href={`/${sport}/${r.player.slug}?stat=${r.stat}&line=${r.line}`}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2"
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{r.rank}</span>
              <PlayerAvatar
                sport={sport}
                externalId={r.player.externalId}
                name={r.player.fullName}
                size={36}
                ring={team.primary}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.player.fullName}</div>
                <div className="truncate text-xs text-muted">
                  {r.player.teamAbbreviation} · {r.side === 'over' ? 'Over' : 'Under'} {r.line}{' '}
                  {r.statShort}
                </div>
              </div>
              <div className={`flex shrink-0 items-center gap-1.5 ${sideCls}`}>
                <LeanArrow tier="Lean" side={r.side} size={15} />
                <span className="text-base font-bold tabular-nums">{r.length}</span>
                <span className="text-xs font-medium text-muted">straight {r.side}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
