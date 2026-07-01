import Link from 'next/link';
import { getLeaders } from '@/lib/server/players';
import { PlayerAvatar } from './PlayerAvatar';
import { getTeam } from '@/lib/teams';
import { STAT_DEFS, type StatKey } from '@/lib/stats';
import { SPORTS, type Sport } from '@/lib/sports';
import { num1 } from '@/lib/format';
import type { LeaderRow } from '@/lib/types';

// The marquee per-game stat to lead the no-games homepage list with, per sport.
const MARQUEE: Record<Sport, StatKey> = { nba: 'pts', mlb: 'hits', nfl: 'passYds' };

/**
 * Compact no-games fallback for the sport hub's heat-check slot. When nothing is on
 * the schedule the live reads describe games that already happened, so instead we show
 * a short season per-game leaders list (evergreen) + a link to the full leaders page.
 * Async server component — only fetches when rendered.
 */
export async function HomeLeadersFallback({ sport }: { sport: Sport }) {
  const cfg = SPORTS[sport];
  const stat = MARQUEE[sport];
  const short = STAT_DEFS[stat].short;
  const label = STAT_DEFS[stat].label;

  let rows: LeaderRow[] = [];
  try {
    rows = await getLeaders(sport, stat, 9);
  } catch {
    // DB unavailable — fall through to the message-only state.
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
          {cfg.name} Heat Check
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium normal-case text-muted">
            no games today
          </span>
        </h2>
        {rows.length > 0 && (
          <Link
            href={`/${sport}/leaders/${stat}`}
            className="shrink-0 text-xs font-medium text-brand hover:text-brand-strong"
          >
            All leaders →
          </Link>
        )}
      </div>
      <p className="mb-3 text-sm text-muted">
        No {cfg.name} games are on the schedule right now, so live reads aren&rsquo;t available — they
        track upcoming and current games. Here are the season&rsquo;s {label.toLowerCase()} leaders, or
        browse{' '}
        <Link href={`/${sport}/players`} className="text-brand hover:text-brand-strong">
          all {cfg.name} players
        </Link>
        .
      </p>

      {rows.length > 0 && (
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((r) => {
            const team = getTeam(sport, r.player.teamAbbreviation);
            return (
              <li key={r.player.slug}>
                <Link
                  href={`/${sport}/${r.player.slug}`}
                  className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted">{r.rank}</span>
                  <PlayerAvatar
                    sport={sport}
                    externalId={r.player.externalId}
                    name={r.player.fullName}
                    size={32}
                    ring={team.primary}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.player.fullName}</div>
                    <div className="truncate text-xs text-muted">
                      {r.player.teamAbbreviation} · {r.gamesPlayed} G
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{num1(r.perGame)}</div>
                    <div className="text-[11px] text-muted">{short}/g</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
