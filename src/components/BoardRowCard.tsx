'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { BoardRow, PlayerResearch, ProvidedVariant } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { PlayerAvatar } from './PlayerAvatar';
import { InjuryBadge } from './InjuryBadge';
import { SportTag } from './SportTag';
import { LeanArrow } from './LeanArrow';
import { PayoutBadge, formatMultiplier } from './PayoutBadge';
import { VariantChips } from './VariantChips';
import { getTeam } from '@/lib/teams';
import { tierTextClass, heatLabel, leanTextClass } from '@/lib/tierStyle';
import { sourceLabel } from '@/lib/providedSources';
import { payoutKind } from '@/lib/payoutVariant';
import { FIREFACTOR_TIER_CUTOFFS } from '@/lib/stats';

/**
 * One board row with an inline payout-variant switcher. The main row is a stretched
 * link to the player page (at the selected rung); the variant chips (see VariantChips)
 * sit above it (z-10) so clicking one switches the shown rung WITHOUT navigating.
 *
 * LAYOUT STABILITY CONTRACT: clicking a chip must not move the chips under the
 * pointer at all (a shifted chip makes the next click miss or fall through to the
 * row link). The chips therefore render FIRST in a non-wrapping meta row — before
 * the side word, line number, and payout badge, all of which change width across
 * rungs — and the right-hand block keeps its context lines mounted (invisible off
 * the default rung) so the row height, and with it the chips' vertical centering,
 * never changes either.
 *
 * The standard line is the no-chip-highlighted state: clicking an active chip cycles
 * that kind's ladder and then funnels back to the plain line when the book has one.
 * Chips render for every kind the row's ladder offers, regardless of the page filter.
 */
export function BoardRowCard({
  sport,
  row,
  source,
  initialLine,
  showSport = false,
}: {
  sport: Sport;
  row: BoardRow;
  source?: string;
  /** Rung to open on when a board filter re-picks it (else the server representative). */
  initialLine?: number;
  /** Prefix the name with a league chip — for the cross-sport ("All") board. */
  showSport?: boolean;
}) {
  const [line, setLine] = useState(initialLine ?? row.line);
  const variants = row.variants ?? [];
  const isDefault = line === row.line;
  const currentRung = variants.find((v) => v.line === line) ?? null;

  // On-click recompute for a non-default rung; the default rung already has its read.
  // The rung's payout context rides along (oddsType + multiplier) so the live verdict
  // stays anchored to the payout being shown even if the book moved/pulled this rung
  // after the board rendered — without it a stale rung would re-score as a plain
  // line against a coin-flip benchmark (a huge, misleading FF cliff).
  const q = useQuery<PlayerResearch>({
    queryKey: ['hitrate', sport, row.player.slug, row.stat, line, source ?? null, currentRung?.oddsType ?? null, currentRung?.multiplier ?? null],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ playerSlug: row.player.slug, stat: row.stat, line: String(line) });
      if (source) params.set('source', source);
      if (currentRung?.oddsType) params.set('oddsType', currentRung.oddsType);
      if (currentRung?.multiplier != null) params.set('multiplier', String(currentRung.multiplier));
      const res = await fetch(`/api/v1/${sport}/hitrate?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as PlayerResearch;
    },
    // Only hit the force-dynamic API when there's no precomputed read to show. Every
    // board rung already carries its own payout-anchored read (`pre` below) with the
    // side/score/tier, so casual chip-clicking paints instantly from it — the live
    // refetch was a redundant edge request + DB read for a verdict already on screen.
    enabled: !isDefault && !currentRung?.read,
    staleTime: 5 * 60 * 1000,
  });

  // The rung's precomputed read paints the switch instantly; the on-click refetch
  // then confirms it with the full live verdict (same math + the payout hint).
  const pre = currentRung?.read ?? null;
  const fireScore = isDefault
    ? row.fireScore
    : (q.data?.verdict.fireScore ??
      (pre ? { ...row.fireScore, side: pre.side, score: pre.score, tier: pre.tier } : row.fireScore));
  const loading = !isDefault && q.isPending && !pre;

  const team = getTeam(sport, row.player.teamAbbreviation);
  const activeKind = payoutKind(currentRung?.oddsType);
  const hasSwitcher = variants.some((v) => payoutKind(v.oddsType) !== 'normal');
  // The strongest scored special rung — powers the small board badge on the default view.
  const bestSpecial = variants.reduce<ProvidedVariant | null>((best, v) => {
    if (payoutKind(v.oddsType) === 'normal' || !v.read) return best;
    return !best || v.read.score > (best.read?.score ?? 0) ? v : best;
  }, null);

  const href = `/${sport}/${row.player.slug}?stat=${row.stat}&line=${line}${source ? `&source=${source}` : ''}`;

  return (
    <li className="relative flex items-center gap-2.5 px-2 py-2.5 transition-colors hover:bg-surface-2 sm:px-3">
      {/* prefetch off: a board can render dozens–hundreds of these rows, and default
          prefetch fires one RSC edge request per visible/hovered link. The player
          page is ISR-fast and has a loading skeleton, so on-click nav stays snappy. */}
      <Link prefetch={false} href={href} aria-label={`${row.player.fullName} ${fireScore.side} ${line} ${row.statShort}`} className="absolute inset-0" />
      <PlayerAvatar sport={sport} externalId={row.player.externalId} name={row.player.fullName} size={36} ring={team.primary} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {showSport && <SportTag sport={sport} />}
          <span className="truncate text-sm font-semibold">{row.player.fullName}</span>
          <InjuryBadge injury={row.player.availability} />
        </div>
        {/* One non-wrapping meta row with the chips FIRST: their position depends on
            nothing that can change on a click — not the side word ("Over"/"Under"),
            not the line number's width, not the right-hand read block. */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          {hasSwitcher && (
            <VariantChips
              variants={variants}
              line={line}
              onSelect={setLine}
              className="relative z-10 shrink-0"
            />
          )}
          {/* Current rung's payout tag (e.g. an Underdog non-1× multiplier on the
              standard line), or the shown rung's badge when there's no switcher.
              Between the chips and the text: toggling it shifts the text, never
              the buttons. */}
          {(!hasSwitcher || activeKind === 'normal') && (
            <span className="shrink-0">
              <PayoutBadge oddsType={currentRung?.oddsType} multiplier={currentRung?.multiplier} showLabel={false} />
            </span>
          )}
          <span className="min-w-0 truncate">
            {row.player.teamAbbreviation} ·{' '}
            <span className={leanTextClass(fireScore.side)}>{fireScore.side === 'over' ? 'Over' : 'Under'}</span>{' '}
            <span className="tabular-nums">{line}</span> {row.statShort}
          </span>
        </div>
      </div>
      <div className={`shrink-0 text-right transition-opacity ${loading ? 'opacity-40' : ''}`}>
        <div
          className={`flex items-center justify-end gap-1 text-sm font-semibold ${tierTextClass(fireScore.tier, fireScore.side)}`}
          title={
            fireScore.tier === 'No lean' || fireScore.tier === 'Pass'
              ? 'No read — recent history gives no meaningful lean on this line.'
              : `${heatLabel(fireScore.tier, fireScore.side)} = ${
                  fireScore.tier === 'Strong lean' ? 'strong' : fireScore.tier === 'Lean' ? 'solid' : 'slight'
                } ${fireScore.side} lean. The word carries the direction (warm = over, cool = under); the FF number is strength only.`
          }
        >
          <LeanArrow tier={fireScore.tier} side={fireScore.side} size={15} decorative />
          {heatLabel(fireScore.tier, fireScore.side)}
        </div>
        {/* Abbreviate on narrow screens (< md) so the row's left text truncates less. */}
        <div className="text-[11px] tabular-nums text-muted">
          <span className="hidden md:inline">FireFactor</span>
          <span className="md:hidden" aria-label="FireFactor">FF</span> {fireScore.score}
        </div>
        {/* The default-line context lines stay MOUNTED (merely invisible) off the
            default rung — losing them would change the row height and re-center the
            chips vertically mid-click. Presence keys off the row's server read so it
            can't flicker as rungs switch. */}
        {row.lineValue?.best && row.lineValue.best.edge >= 0.05 && (
          <div className={`text-[10px] tabular-nums text-muted ${isDefault ? '' : 'invisible'}`}>
            best: {sourceLabel(row.lineValue.best.source)} +{Math.round(row.lineValue.best.edge * 100)}
          </div>
        )}
        {/* A special rung scoring a real read above the default line — the chips
            funnel straight to it. */}
        {bestSpecial?.read && bestSpecial.read.score >= FIREFACTOR_TIER_CUTOFFS.slight && bestSpecial.read.score > row.fireScore.score && (
          <div className={`text-[10px] tabular-nums text-heat-1 ${isDefault ? '' : 'invisible'}`}>
            {specialWord(bestSpecial)}: FF {bestSpecial.read.score}
          </div>
        )}
      </div>
    </li>
  );
}

/** The badge's word for a special rung: the kind, or the exact multiplier. */
function specialWord(v: ProvidedVariant): string {
  const kind = payoutKind(v.oddsType);
  if (kind === 'alternate') return v.multiplier != null ? formatMultiplier(v.multiplier) : 'alt';
  return kind;
}
