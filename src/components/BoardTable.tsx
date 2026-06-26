import Link from 'next/link';
import type { BoardRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { PlayerAvatar } from './PlayerAvatar';
import { LeanArrow } from './LeanArrow';
import { getTeam } from '@/lib/teams';
import { tierTextClass, heatLabel } from '@/lib/tierStyle';
import { sourceLabel } from '@/lib/providedSources';

/**
 * Ranked cross-player board (presentational). Each row links to the player page
 * with the stat + line preselected so the user can enter the real book line.
 */
export function BoardTable({ sport, rows }: { sport: Sport; rows: BoardRow[] }) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => {
        const team = getTeam(sport, r.player.teamAbbreviation);
        const dir = r.fireScore.tier === 'Pass' ? '' : r.fireScore.side === 'over' ? 'Over' : 'Under';
        return (
          <li key={`${r.player.slug}-${r.stat}`}>
            <Link
              href={`/${sport}/${r.player.slug}?stat=${r.stat}&line=${r.line}`}
              className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-2"
            >
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
                  {r.player.teamAbbreviation} · {dir ? `${dir} ` : ''}
                  {r.line} {r.statShort}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={`flex items-center justify-end gap-1 text-sm font-semibold ${tierTextClass(r.fireScore.tier, r.fireScore.side)}`}
                >
                  <LeanArrow tier={r.fireScore.tier} side={r.fireScore.side} size={15} />
                  {heatLabel(r.fireScore.tier, r.fireScore.side)}
                </div>
                <div className="text-[11px] tabular-nums text-muted">
                  FireFactor {r.fireScore.score}
                </div>
                {r.lineValue?.best && r.lineValue.best.edge >= 0.05 && (
                  <div className="text-[10px] tabular-nums text-muted">
                    best: {sourceLabel(r.lineValue.best.source)} +
                    {Math.round(r.lineValue.best.edge * 100)}
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
