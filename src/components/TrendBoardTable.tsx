'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TrendRow, TrendRung } from '@/lib/types';
import { getTeam } from '@/lib/teams';
import { pct } from '@/lib/format';
import { payoutKind } from '@/lib/payoutVariant';
import { PlayerAvatar } from './PlayerAvatar';
import { InjuryBadge } from './InjuryBadge';
import { SportTag } from './SportTag';
import { LeanArrow } from './LeanArrow';
import { PayoutBadge } from './PayoutBadge';
import { VariantChips } from './VariantChips';
import { leanTextClass } from '@/lib/tierStyle';

/** The row's own top-level snapshot as a TrendRung (the standard-preferred rung). */
function headlineRung(r: TrendRow): TrendRung {
  return {
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
  };
}

/** The trend snapshot for a specific line: the matching `rungTrends` entry, else the
 *  row's headline snapshot (which is also the fallback for the headline line itself). */
function trendAt(r: TrendRow, line: number): TrendRung {
  if (line !== r.line) {
    const rt = r.rungTrends?.find((x) => x.line === line);
    if (rt) return rt;
  }
  return headlineRung(r);
}

/**
 * The rung a trend row should DISPLAY: the payout filter's pick (via `initialLines`,
 * keyed `${slug}:${stat}`) when it differs from the row's headline rung — so a
 * "goblins only" view shows each goblin line's own swing — else the row's top-level
 * (standard-preferred) snapshot. Exported for the explorers' re-ranking.
 */
export function displayedTrend(r: TrendRow, initialLines?: Map<string, number>): TrendRung {
  const target = initialLines?.get(`${r.player.slug}:${r.stat}`);
  return trendAt(r, target ?? r.line);
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
        const initialLine = initialLines?.get(`${r.player.slug}:${r.stat}`) ?? r.line;
        return (
          <TrendRowCard
            // Keyed on the filter's pick too, so a kinds/multiplier change re-opens
            // the row at the newly-picked rung.
            key={`${r.player.sport}-${r.player.slug}-${r.stat}-${initialLine}`}
            row={r}
            source={source}
            initialLine={initialLine}
            showSport={showSport}
          />
        );
      })}
    </ol>
  );
}

/**
 * One trend row with the same inline payout-variant switcher as the Heat Check rows.
 * The row is a STRETCHED link to the player page (at the shown rung); the chips sit
 * above it (z-10) as siblings — never inside the anchor — so clicking a demon/goblin/
 * alternate chip cycles the ladder in place (or does nothing on a one-rung ladder)
 * and NEVER navigates. Same layout-stability contract as BoardRowCard: chips first in
 * a non-wrapping meta row, and the streak line stays mounted (invisible) on rungs
 * without one so the chips never move vertically mid-cycle.
 */
function TrendRowCard({
  row: r,
  source,
  initialLine,
  showSport,
}: {
  row: TrendRow;
  source?: string;
  initialLine: number;
  showSport: boolean;
}) {
  const [line, setLine] = useState(initialLine);
  const sport = r.player.sport;
  const team = getTeam(sport, r.player.teamAbbreviation);
  const variants = r.variants ?? [];
  const hasSwitcher = variants.some((v) => payoutKind(v.oddsType) !== 'normal');
  const d = trendAt(r, line);
  const activeKind = payoutKind(d.oddsType);
  const sideCls = d.side === 'over' ? 'text-over' : 'text-under';
  // Any rung's streak — the mounted-but-invisible placeholder that keeps the row
  // height (and the chips' vertical centering) fixed across rung switches.
  const streakSample =
    d.streak ?? r.streak ?? r.rungTrends?.find((rt) => rt.streak)?.streak ?? null;

  return (
    <li className="relative flex items-center gap-2 px-2 py-2.5 transition-colors hover:bg-surface-2 sm:gap-3 sm:px-3">
      <Link
        href={`/${sport}/${r.player.slug}?stat=${r.stat}&line=${d.line}${source ? `&source=${source}` : ''}`}
        aria-label={`${r.player.fullName} ${d.side} ${d.line} ${r.statShort}`}
        className="absolute inset-0"
      />
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
        {/* Chips FIRST in a non-wrapping meta row — same stability contract as the
            Heat Check rows: nothing that changes width across rungs sits before them. */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          {hasSwitcher && (
            <VariantChips
              variants={variants}
              line={line}
              onSelect={setLine}
              className="relative z-10 shrink-0"
            />
          )}
          {(!hasSwitcher || activeKind === 'normal') && (
            <span className="shrink-0">
              <PayoutBadge oddsType={d.oddsType} multiplier={d.multiplier} showLabel={false} glyphSize={11} />
            </span>
          )}
          <span className="min-w-0 truncate">
            {r.player.teamAbbreviation} ·{' '}
            <span className={leanTextClass(d.side)}>{d.side === 'over' ? 'Over' : 'Under'}</span>{' '}
            <span className="tabular-nums">{d.line}</span> {r.statShort}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={`flex items-center justify-end gap-1 text-sm font-semibold ${sideCls}`}
        >
          <LeanArrow tier="Lean" side={d.side} size={14} />
          {Math.round(d.recentRate * d.recentGames)} of {d.recentGames}
        </div>
        <div className="text-[11px] tabular-nums text-muted">
          {pct(d.recentRate)} <span className="text-muted/80">L10</span>
          <span className="hidden sm:inline"> · vs {pct(d.seasonRate)} season</span>
        </div>
        {streakSample && (
          <div
            className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium ${
              !d.streak ? 'invisible' : d.streak.side === 'over' ? 'text-over' : 'text-under'
            }`}
          >
            <LeanArrow tier="Lean" side={(d.streak ?? streakSample).side} size={11} />
            {(d.streak ?? streakSample).length} straight
          </div>
        )}
      </div>
    </li>
  );
}
