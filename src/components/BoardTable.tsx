import Link from 'next/link';
import type { BoardRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { PlayerAvatar } from './PlayerAvatar';
import { getTeam } from '@/lib/teams';
import { num1 } from '@/lib/format';

const TIER_TEXT: Record<string, string> = {
  'Strong lean': 'text-emerald-300',
  Lean: 'text-emerald-300',
  'Slight lean': 'text-amber-300',
  'No lean': 'text-muted',
  Pass: 'text-muted',
};

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
                  {r.player.teamAbbreviation} · {dir ? `${dir} ` : ''}
                  {r.line} {r.statShort}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-sm font-semibold ${TIER_TEXT[r.fireScore.tier] ?? 'text-muted'}`}>
                  {r.fireScore.tier}
                </div>
                <div className="text-[11px] tabular-nums text-muted">
                  FireScore {r.fireScore.score} · est {num1(r.projection)}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
