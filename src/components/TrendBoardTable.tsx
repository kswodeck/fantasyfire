import Link from 'next/link';
import type { TrendRow, TrendRung } from '@/lib/types';
import { getTeam } from '@/lib/teams';
import { pct } from '@/lib/format';
import { PlayerAvatar } from './PlayerAvatar';
import { InjuryBadge } from './InjuryBadge';
import { SportTag } from './SportTag';
import { LeanArrow } from './LeanArrow';
import { PayoutBadge } from './PayoutBadge';

/**
 * The rung a trend row should DISPLAY: the payout filter's pick (via `initialLines`,
 * keyed `${slug}:${stat}`) when it differs from the row's headline rung — so a
 * "goblins only" view shows each goblin line's own swing — else the row's top-level
 * (standard-preferred) snapshot.
 */
export function displayedTrend(r: TrendRow, initialLines?: Map<string, number>): TrendRung {
  const target = initialLines?.get(`${r.player.slug}:${r.stat}`);
  const swapped = target != null ? r.rungTrends?.find((rt) => rt.line === target) : undefined;
  return (
    swapped ?? {
      line: r.line,
      oddsType: r.oddsType ?? null,
      multiplier: r.multiplier ?? null,
      side: r.side,
      recentRate: r.recentRate,
      recentLower: r.recentLower,
      recentGames: r.recentGames,
      seasonRate: r.seasonRate,
      delta: r.delta,
      streak: r.streak,
    }
  );
}

/** Ranked recent-form trend board: L10 rate + swing vs the season baseline. Sport is
 *  read per-row, so it renders single- or mixed-sport boards; `showSport` adds a chip.
 *  Rows computed against a payout variant (goblin/demon/alternate) carry its badge;
 *  `source` threads the book into the player-page link so the read matches. */
export function TrendBoardTable({
  rows,
  source,
  initialLines,
  showSport = false,
}: {
  rows: TrendRow[];
  /** Book the shown trends belong to — carried into each row's player-page link. */
  source?: string;
  /** Per `${slug}:${stat}` rung the payout filter picked — displays THAT rung's trend. */
  initialLines?: Map<string, number>;
  showSport?: boolean;
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => {
        const sport = r.player.sport;
        const team = getTeam(sport, r.player.teamAbbreviation);
        const d = displayedTrend(r, initialLines);
        const sideCls = d.side === 'over' ? 'text-over' : 'text-under';
        return (
          <li key={`${sport}-${r.player.slug}-${r.stat}`}>
            <Link
              href={`/${sport}/${r.player.slug}?stat=${r.stat}&line=${d.line}${source ? `&source=${source}` : ''}`}
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
                  {showSport && <SportTag sport={sport} />}
                  <span className="truncate text-sm font-semibold">
                    {r.player.fullName}
                  </span>
                  <InjuryBadge injury={r.player.availability} />
                </div>
                <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <span className="truncate">
                    {r.player.teamAbbreviation} · {d.side === 'over' ? 'Over' : 'Under'}{' '}
                    {d.line} {r.statShort}
                  </span>
                  <PayoutBadge oddsType={d.oddsType} multiplier={d.multiplier} showLabel={false} glyphSize={11} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={`flex items-center justify-end gap-1 text-sm font-semibold ${sideCls}`}
                >
                  <LeanArrow tier="Lean" side={d.side} size={14} />
                  {Math.round(d.recentRate * d.recentGames)} of {d.recentGames}{' '}
                  <span className="text-xs font-normal text-muted">L10</span>
                </div>
                <div className="text-[11px] tabular-nums text-muted">
                  {pct(d.recentRate)} · +{Math.round(d.delta * 100)}
                  <span className="hidden sm:inline"> vs {pct(d.seasonRate)} season</span>
                </div>
                {d.streak && (
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium ${
                      d.streak.side === 'over' ? 'text-over' : 'text-under'
                    }`}
                  >
                    <LeanArrow tier="Lean" side={d.streak.side} size={11} />
                    {d.streak.length} straight {d.streak.side}
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
