'use client';

import { useState } from 'react';
import type {
  AccuracyBreakdown,
  AccuracySideFilter,
  LeanTierSegment,
  WinRecord,
  YesterdayRecap,
} from '@/lib/types';
import { formatIsoDate } from '@/lib/format';
import {
  rowMatches,
  recordFor,
  TIER_SEGMENT_OPTIONS,
  SIDE_FILTER_OPTIONS,
} from '@/lib/accuracySegments';
import { RecapRowList } from './YesterdayRecapStrip';

type TierKey = LeanTierSegment | 'all';

function pctLanded(rec: WinRecord): string {
  const settled = rec.hits + rec.misses;
  return settled === 0 ? '—' : `${Math.round((rec.hits / settled) * 100)}%`;
}

/**
 * Interactive accuracy view: filter the settled-lean records by STRENGTH SEGMENT
 * (all / extreme=Blazing-Frozen / normal=Hot-Cold / slight=Warm-Cool) and by SIDE
 * (both / over / under). The segment tiles read from the server-computed breakdown
 * (authoritative over every settled row); the per-day list filters the shipped rows
 * client-side. `daysAreSample` is set on the all-sports page, where the day list is
 * a capped top-leans sample while the tiles still reflect the full record.
 */
export function AccuracyExplorer({
  days,
  breakdown,
  showSport = false,
  daysAreSample = false,
}: {
  days: YesterdayRecap[];
  breakdown: AccuracyBreakdown;
  /** Tag each row with its league (all-sports view); off for a single-sport page. */
  showSport?: boolean;
  daysAreSample?: boolean;
}) {
  const [tier, setTier] = useState<TierKey>('all');
  const [side, setSide] = useState<AccuracySideFilter>('both');

  // Recompute each day's record from the FILTERED rows so the day header matches
  // exactly what's listed below it (not the day's full, unfiltered total).
  const filteredDays = [];

  for (const d of days) {
    const rows = d.rows.filter((r) => rowMatches(r, tier, side));
  
    if (rows.length === 0) continue;
  
    filteredDays.push({
      date: d.date,
      rows,
      hits: rows.filter((r) => r.result === "hit").length,
      misses: rows.filter((r) => r.result === "miss").length,
      pushes: rows.filter((r) => r.result === "push").length,
    });
  
    if (filteredDays.length === 30) break;
  }

  const headline = recordFor(breakdown, tier, side);
  const headlineSettled = headline.hits + headline.misses;

  return (
    <div>
      {/* Side filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Side</span>
        {SIDE_FILTER_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setSide(o.key)}
            aria-pressed={side === o.key}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              side === o.key
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-line bg-surface text-muted hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Strength-segment tiles double as the tier selector. Each shows its record
          at the current side filter; clicking sets the active segment. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TIER_SEGMENT_OPTIONS.map((o) => {
          const rec = recordFor(breakdown, o.key, side);
          const settled = rec.hits + rec.misses;
          const active = tier === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setTier(o.key)}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-brand/40'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {o.label}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                {settled === 0 ? '—' : `${rec.hits} of ${settled}`}
              </div>
              <div className="text-[11px] text-muted">
                {settled === 0
                  ? o.hint
                  : `${pctLanded(rec)} landed · ${o.hint}${rec.pushes > 0 ? ` · ${rec.pushes} push` : ''}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active-filter headline */}
      <p className="mt-4 text-sm text-muted">
        Showing{' '}
        <strong className="text-foreground">
          {tier === 'all' ? 'all leans' : TIER_SEGMENT_OPTIONS.find((o) => o.key === tier)!.label.toLowerCase() + ' leans'}
        </strong>
        {side !== 'both' && (
          <>
            {' '}on the <strong className="text-foreground">{side}</strong>
          </>
        )}
        {headlineSettled > 0 && (
          <>
            {' '}— <span className="tabular-nums">{headline.hits} of {headlineSettled}</span> landed (
            {pctLanded(headline)})
          </>
        )}
        .
      </p>

      {/* Per-day settled rows for the active filter */}
      {filteredDays.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No settled {side !== 'both' ? `${side} ` : ''}leans in this segment over the recent slates.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {filteredDays.map((d) => {
            const settled = d.hits + d.misses;
            return (
              <section
                key={d.date}
                aria-label={`Settled leans for ${d.date}`}
                className="rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="text-sm font-semibold">{formatIsoDate(d.date)}</h2>
                  <span className="text-sm font-semibold tabular-nums">
                    {d.hits} of {settled} landed
                    {d.pushes > 0 && <span className="font-normal text-muted"> · {d.pushes} push</span>}
                  </span>
                </div>
                <div className="mt-3">
                  <RecapRowList rows={d.rows} showSport={showSport} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {daysAreSample && (
        <p className="mt-3 text-[11px] text-muted">
          The segment records above cover every settled lean across all leagues; each day&rsquo;s
          list shows the top leans as examples.
        </p>
      )}
    </div>
  );
}
