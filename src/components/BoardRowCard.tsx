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
import { PayoutBadge, PayoutGlyph, formatMultiplier } from './PayoutBadge';
import { getTeam } from '@/lib/teams';
import { tierTextClass, heatLabel } from '@/lib/tierStyle';
import { sourceLabel } from '@/lib/providedSources';
import { payoutKind, type PayoutKind } from '@/lib/payoutVariant';

const KIND_ORDER: PayoutKind[] = ['normal', 'demon', 'goblin', 'alternate'];

function rungsOfKind(variants: ProvidedVariant[], kind: PayoutKind): ProvidedVariant[] {
  return variants.filter((v) => payoutKind(v.oddsType) === kind).sort((a, b) => a.line - b.line);
}

function nearest(rungs: ProvidedVariant[], to: number): ProvidedVariant {
  return rungs.reduce((best, r) => (Math.abs(r.line - to) < Math.abs(best.line - to) ? r : best));
}

/**
 * One board row with an inline payout-variant switcher. The main row is a stretched
 * link to the player page (at the selected rung); the type chips sit above it (z-10)
 * so clicking one switches the shown rung WITHOUT navigating. Switching recomputes
 * the FireFactor on click via the hitrate API (React Query caches per line). A source
 * with a single plain line renders exactly as before (no chips).
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

  const fireScore = isDefault ? row.fireScore : (q.data?.verdict.fireScore ?? row.fireScore);
  const loading = !isDefault && q.isPending;
  const currentRung = variants.find((v) => v.line === line) ?? null;

  const team = getTeam(sport, row.player.teamAbbreviation);
  const dir = fireScore.tier === 'Pass' ? '' : fireScore.side === 'over' ? 'Over' : 'Under';
  const kinds = KIND_ORDER.filter((k) => variants.some((v) => payoutKind(v.oddsType) === k));
  const activeKind = payoutKind(currentRung?.oddsType);
  const hasSwitcher = variants.length > 1;

  // Click a kind chip: switch to that kind (nearest the current line); clicking the
  // already-active kind cycles to its next rung — so multiple demons/goblins are all
  // reachable and distinguishable by the line that changes.
  const pickKind = (kind: PayoutKind) => {
    const rungs = rungsOfKind(variants, kind);
    if (rungs.length === 0) return;
    if (kind === activeKind && rungs.length > 1) {
      const idx = rungs.findIndex((r) => r.line === line);
      setLine(rungs[(idx + 1) % rungs.length].line);
    } else {
      setLine(nearest(rungs, line).line);
    }
  };

  const chipFor = (kind: PayoutKind) => {
    const active = kind === activeKind;
    const rungs = rungsOfKind(variants, kind);
    const base =
      'relative z-10 inline-flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none transition-colors';
    const tone =
      kind === 'demon'
        ? active
          ? 'border-demon/40 bg-demon/12 text-demon'
          : 'border-line text-muted hover:text-demon'
        : kind === 'goblin'
          ? active
            ? 'border-goblin/40 bg-goblin/12 text-goblin'
            : 'border-line text-muted hover:text-goblin'
          : kind === 'alternate'
            ? active
              ? 'border-heat-1/40 bg-heat-1/12 text-heat-1'
              : 'border-line text-muted hover:text-foreground'
            : active
              ? 'border-line bg-surface-2 text-foreground'
              : 'border-line text-muted hover:text-foreground';
    const altMult = kind === 'alternate' ? (active ? currentRung?.multiplier : rungs[0]?.multiplier) : null;
    const label =
      kind === 'demon' ? (
        <PayoutGlyph kind="demon" size={12} />
      ) : kind === 'goblin' ? (
        <PayoutGlyph kind="goblin" size={12} />
      ) : kind === 'alternate' ? (
        <span className="tabular-nums">{altMult != null ? formatMultiplier(altMult) : 'alt'}</span>
      ) : (
        <span className="tabular-nums">1×</span>
      );
    return (
      <button
        key={kind}
        type="button"
        onClick={() => pickKind(kind)}
        aria-pressed={active}
        title={
          kind === 'demon'
            ? 'Demon — harder line, pays more'
            : kind === 'goblin'
              ? 'Goblin — easier line, pays less'
              : kind === 'alternate'
                ? 'Underdog alternate — boosted/discounted payout'
                : 'Standard line'
        }
        className={`${base} ${tone}`}
      >
        {label}
      </button>
    );
  };

  const href = `/${sport}/${row.player.slug}?stat=${row.stat}&line=${line}${source ? `&source=${source}` : ''}`;

  return (
    <li className="relative flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-2">
      <Link href={href} aria-label={`${row.player.fullName} ${dir} ${line} ${row.statShort}`} className="absolute inset-0" />
      <PlayerAvatar sport={sport} externalId={row.player.externalId} name={row.player.fullName} size={36} ring={team.primary} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {showSport && <SportTag sport={sport} />}
          <span className="truncate text-sm font-semibold">{row.player.fullName}</span>
          <InjuryBadge injury={row.player.availability} />
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
          <span className="truncate">
            {row.player.teamAbbreviation} · {dir ? `${dir} ` : ''}
            <span className="tabular-nums">{line}</span> {row.statShort}
          </span>
          {hasSwitcher ? (
            <span className="flex items-center gap-1">{kinds.map(chipFor)}</span>
          ) : (
            <PayoutBadge oddsType={currentRung?.oddsType} multiplier={currentRung?.multiplier} showLabel={false} />
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
      </div>
    </li>
  );
}
