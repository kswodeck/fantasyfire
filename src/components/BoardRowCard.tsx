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
import { tierTextClass, heatLabel } from '@/lib/tierStyle';
import { sourceLabel } from '@/lib/providedSources';
import { payoutKind } from '@/lib/payoutVariant';
import { FIREFACTOR_TIER_CUTOFFS } from '@/lib/stats';

/**
 * One board row with an inline payout-variant switcher. The main row is a stretched
 * link to the player page (at the selected rung); the variant chips (see VariantChips)
 * sit above it (z-10) so clicking one switches the shown rung WITHOUT navigating.
 *
 * LAYOUT STABILITY CONTRACT: clicking a chip must not move the chips under the
 * pointer (a shifted chip makes the next click fall through to the row link). The
 * meta row therefore never wraps, the side word always renders (even on a Pass), the
 * chips keep a fixed structure, and the payout badge sits AFTER the chips so its
 * appearing/disappearing never displaces them.
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

  // On-click recompute for a non-default rung; the default rung already has its read.
  const q = useQuery<PlayerResearch>({
    queryKey: ['hitrate', sport, row.player.slug, row.stat, line, source ?? null],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ playerSlug: row.player.slug, stat: row.stat, line: String(line) });
      if (source) params.set('source', source);
      const res = await fetch(`/api/v1/${sport}/hitrate?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as PlayerResearch;
    },
    enabled: !isDefault,
    staleTime: 5 * 60 * 1000,
  });

  const currentRung = variants.find((v) => v.line === line) ?? null;
  // The rung's precomputed read paints the switch instantly; the on-click refetch
  // then confirms it with the full live verdict (they agree — same math).
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
    <li className="relative flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-2">
      <Link href={href} aria-label={`${row.player.fullName} ${fireScore.side} ${line} ${row.statShort}`} className="absolute inset-0" />
      <PlayerAvatar sport={sport} externalId={row.player.externalId} name={row.player.fullName} size={36} ring={team.primary} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {showSport && <SportTag sport={sport} />}
          <span className="truncate text-sm font-semibold">{row.player.fullName}</span>
          <InjuryBadge injury={row.player.availability} />
        </div>
        {/* One non-wrapping meta row: text | chips | badge — see the stability contract. */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="min-w-0 truncate">
            {row.player.teamAbbreviation} ·{' '}
            {fireScore.side === 'over' ? 'Over' : 'Under'}{' '}
            <span className="tabular-nums">{line}</span> {row.statShort}
          </span>
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
              AFTER the chips, so toggling it never moves them. */}
          {(!hasSwitcher || activeKind === 'normal') && (
            <span className="shrink-0">
              <PayoutBadge oddsType={currentRung?.oddsType} multiplier={currentRung?.multiplier} showLabel={false} />
            </span>
          )}
        </div>
      </div>
      <div className={`shrink-0 text-right transition-opacity ${loading ? 'opacity-40' : ''}`}>
        <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${tierTextClass(fireScore.tier, fireScore.side)}`}>
          <LeanArrow tier={fireScore.tier} side={fireScore.side} size={15} />
          {heatLabel(fireScore.tier, fireScore.side)}
        </div>
        <div className="text-[11px] tabular-nums text-muted">FireFactor {fireScore.score}</div>
        {isDefault && row.lineValue?.best && row.lineValue.best.edge >= 0.05 && (
          <div className="text-[10px] tabular-nums text-muted">
            best: {sourceLabel(row.lineValue.best.source)} +{Math.round(row.lineValue.best.edge * 100)}
          </div>
        )}
        {/* A special rung scoring a real read above the shown line — the chips funnel
            straight to it. */}
        {isDefault && bestSpecial?.read && bestSpecial.read.score >= FIREFACTOR_TIER_CUTOFFS.slight && bestSpecial.read.score > fireScore.score && (
          <div className="text-[10px] tabular-nums text-heat-1">
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
