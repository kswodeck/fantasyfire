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

const SPECIAL_KINDS: PayoutKind[] = ['demon', 'goblin', 'alternate'];

const CHIP =
  'relative z-10 inline-flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none transition-colors';

function rungsOfKind(variants: ProvidedVariant[], kind: PayoutKind): ProvidedVariant[] {
  return variants.filter((v) => payoutKind(v.oddsType) === kind).sort((a, b) => a.line - b.line);
}

function nearest(rungs: ProvidedVariant[], to: number): ProvidedVariant {
  return rungs.reduce((best, r) => (Math.abs(r.line - to) < Math.abs(best.line - to) ? r : best));
}

/**
 * One board row with an inline payout-variant switcher. The main row is a stretched
 * link to the player page (at the selected rung); the variant chips sit above it (z-10)
 * so clicking one switches the shown rung WITHOUT navigating. Switching recomputes
 * the FireFactor on click via the hitrate API (React Query caches per line).
 *
 * Chips exist only for the SPECIAL kinds — a demon chip, a goblin chip, and one chip
 * per Underdog alternate rung (labelled with its multiplier). The standard line is the
 * no-chip-highlighted state: clicking an active chip funnels back to the plain line
 * (when the book has one), and cycling an active demon/goblin walks its rungs before
 * returning to standard. `enabledKinds` (from the board's payout filter) hides chips
 * for de-selected kinds. A source with a single plain line renders with no chips.
 */
export function BoardRowCard({
  sport,
  row,
  source,
  initialLine,
  enabledKinds,
  showSport = false,
}: {
  sport: Sport;
  row: BoardRow;
  source?: string;
  /** Rung to open on when a board filter re-picks it (else the server representative). */
  initialLine?: number;
  /** Kinds the board's payout filter has selected — chips of other kinds are hidden
   *  (undefined = no filter on this page → show every kind the row offers). */
  enabledKinds?: Set<PayoutKind>;
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
  const activeKind = payoutKind(currentRung?.oddsType);
  const normals = rungsOfKind(variants, 'normal');
  const kindEnabled = (k: PayoutKind) => enabledKinds === undefined || enabledKinds.has(k);
  const specialKinds = SPECIAL_KINDS.filter(
    (k) => kindEnabled(k) && variants.some((v) => payoutKind(v.oddsType) === k),
  );
  const hasSwitcher = specialKinds.length > 0;

  // Funnel back to the plain/standard line (nearest normal rung) when the book has one.
  const toNormal = () => {
    if (normals.length > 0) setLine(nearest(normals, line).line);
  };

  // Click a demon/goblin chip: switch to that kind (nearest the current line); clicking
  // the already-active kind cycles its rungs, then funnels back to the standard line
  // (no chip highlighted) — so every rung AND the plain line are reachable in place.
  const pickKind = (kind: PayoutKind) => {
    const rungs = rungsOfKind(variants, kind);
    if (rungs.length === 0) return;
    if (kind === activeKind) {
      const idx = rungs.findIndex((r) => r.line === line);
      if (idx < rungs.length - 1) setLine(rungs[idx + 1].line);
      else if (normals.length > 0) toNormal();
      else setLine(rungs[0].line); // no standard line to return to — wrap around
    } else {
      setLine(nearest(rungs, line).line);
    }
  };

  const glyphChip = (kind: 'demon' | 'goblin') => {
    const active = kind === activeKind;
    const tone =
      kind === 'demon'
        ? active
          ? 'border-demon/40 bg-demon/12 text-demon'
          : 'border-line text-muted hover:text-demon'
        : active
          ? 'border-goblin/40 bg-goblin/12 text-goblin'
          : 'border-line text-muted hover:text-goblin';
    return (
      <button
        key={kind}
        type="button"
        onClick={() => pickKind(kind)}
        aria-pressed={active}
        title={
          kind === 'demon'
            ? 'Demon — harder line, pays more (over only). Click again for the standard line.'
            : 'Goblin — easier line, pays less (over only). Click again for the standard line.'
        }
        className={`${CHIP} ${tone}`}
      >
        <PayoutGlyph kind={kind} size={12} />
      </button>
    );
  };

  // One chip per alternate rung, labelled with its multiplier — click to funnel through
  // that exact line; click the active one to return to the standard line.
  const alternateChips = () =>
    rungsOfKind(variants, 'alternate').map((v) => {
      const active = v.line === line;
      const tone = active
        ? 'border-heat-1/40 bg-heat-1/12 text-heat-1'
        : 'border-line text-muted hover:text-foreground';
      return (
        <button
          key={`alt-${v.line}`}
          type="button"
          onClick={() => (active ? toNormal() : setLine(v.line))}
          aria-pressed={active}
          title={`Alternate line ${v.line}${v.multiplier != null ? ` — ${formatMultiplier(v.multiplier)} payout` : ''} (over only). Click again for the standard line.`}
          className={`${CHIP} ${tone}`}
        >
          <span className="tabular-nums">
            {v.multiplier != null ? formatMultiplier(v.multiplier) : v.line}
          </span>
        </button>
      );
    });

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
          {/* The standard line's own payout tag (e.g. an Underdog non-1× multiplier),
              or the shown rung's badge when this row has no switcher at all. Skipped
              when a special rung's own chip is already highlighted. */}
          {(!hasSwitcher || activeKind === 'normal') && (
            <PayoutBadge oddsType={currentRung?.oddsType} multiplier={currentRung?.multiplier} showLabel={false} />
          )}
          {hasSwitcher && (
            <span className="flex flex-wrap items-center gap-1">
              {specialKinds.includes('demon') && glyphChip('demon')}
              {specialKinds.includes('goblin') && glyphChip('goblin')}
              {specialKinds.includes('alternate') && alternateChips()}
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
      </div>
    </li>
  );
}
