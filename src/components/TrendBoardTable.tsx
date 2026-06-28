import Link from 'next/link';
import type { TrendRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { getTeam } from '@/lib/teams';
import { pct } from '@/lib/format';
import { PlayerAvatar } from './PlayerAvatar';
import { InjuryBadge } from './InjuryBadge';
import { LeanArrow } from './LeanArrow';

/** Ranked recent-form trend board: L10 rate + swing vs the season baseline. */
export function TrendBoardTable({ sport, rows }: { sport: Sport; rows: TrendRow[] }) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => {
        const team = getTeam(sport, r.player.teamAbbreviation);
        const sideCls = r.side === 'over' ? 'text-over' : 'text-under';
        return (
          <li key={`${r.player.slug}-${r.stat}`}>
            <Link
              href={`/${sport}/${r.player.slug}?stat=${r.stat}&line=${r.line}`}
              className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-surface-2 sm:gap-3"
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
                  {r.player.teamAbbreviation} · {r.side === 'over' ? 'Over' : 'Under'}{' '}
                  {r.line} {r.statShort}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={`flex items-center justify-end gap-1 text-sm font-semibold ${sideCls}`}
                >
                  <LeanArrow tier="Lean" side={r.side} size={14} />
                  {Math.round(r.recentRate * r.recentGames)} of {r.recentGames}{' '}
                  <span className="text-xs font-normal text-muted">L10</span>
                </div>
                <div className="text-[11px] tabular-nums text-muted">
                  {pct(r.recentRate)} · +{Math.round(r.delta * 100)}
                  <span className="hidden sm:inline"> vs {pct(r.seasonRate)} season</span>
                </div>
                {r.streak && (
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium ${
                      r.streak.side === 'over' ? 'text-over' : 'text-under'
                    }`}
                  >
                    <LeanArrow tier="Lean" side={r.streak.side} size={11} />
                    {r.streak.length} straight {r.streak.side}
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
