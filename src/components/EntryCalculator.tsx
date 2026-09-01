'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { PlayerResearch } from '@/lib/types';
import type { SavedProp } from '@/lib/savedProps';
import { STAT_DEFS } from '@/lib/stats';
import { pct } from '@/lib/format';
import { leanTextClass } from '@/lib/tierStyle';
import { entryEvs, avgLegProb, type EntryEv } from '@/lib/entryEv';
import { correlationWarning, hasCorrelation, correlatedLegKeys } from '@/lib/correlation';
import { PP_POWER_PLAY, PP_FLEX_PLAY } from '@/lib/ppPayouts';
import { BookLink } from './BookLink';
import { AffiliateDisclosure } from './AffiliateDisclosure';

// The PrizePicks entry-EV calculator on the Playbook: combine saved PrizePicks
// STANDARD legs into a Power/Flex entry and see what it actually pays. Every
// number is model math over the legs' historical win probabilities — see the
// honesty caption. Only standard PrizePicks legs are eligible: the Power/Flex
// tables (ppPayouts.ts) apply to standard legs, and demons/goblins change the
// whole entry's multiplier in ways PrizePicks doesn't publish.

const PP_ENTRY_SIZES = [
  ...new Set([...PP_POWER_PLAY.map((r) => r.picks), ...PP_FLEX_PLAY.map((r) => r.picks)]),
].sort((a, b) => a - b);
const MIN_LEGS = Math.min(...PP_ENTRY_SIZES);
const MAX_LEGS = Math.max(...PP_ENTRY_SIZES);

/** A saved PrizePicks standard leg with its fetched model P(hit). */
interface Leg {
  prop: SavedProp;
  /** Model P(the saved side hits); null while loading or unavailable. */
  pHit: number | null;
  loading: boolean;
  /** The scheduled game this leg is for — drives same-game correlation detection.
   *  Null until the read loads, or when the player has no upcoming game. */
  gameId: string | null;
}

export function EntryCalculator({ props }: { props: SavedProp[] }) {
  // Eligible legs: PrizePicks, standard rung (no payout variant), one per
  // player+stat+side (dedupe repeated saves), capped so we never fan out an
  // absurd number of requests.
  const eligibleProps = useMemo(() => {
    const seen = new Set<string>();
    const out: SavedProp[] = [];
    for (const p of props) {
      if (p.source !== 'prizepicks') continue;
      if (p.oddsType && p.oddsType !== 'standard') continue; // demons/goblins excluded
      const k = `${p.slug}:${p.stat}:${p.side}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out.slice(0, 12);
  }, [props]);

  // Fetch each eligible leg's read once; extract the model P(hit) for its side.
  const results = useQueries({
    queries: eligibleProps.map((p) => ({
      queryKey: ['hitrate', p.sport, p.slug, p.stat, p.line, p.source, null, null],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const params = new URLSearchParams({ playerSlug: p.slug, stat: p.stat, line: String(p.line), source: p.source });
        const res = await fetch(`/api/v1/${p.sport}/hitrate?${params.toString()}`, { signal });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return (await res.json()) as PlayerResearch;
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const legs: Leg[] = eligibleProps.map((prop, i) => {
    const r = results[i];
    const over = r.data?.verdict.modelProbOver ?? null;
    const pHit = over === null ? null : prop.side === 'over' ? over : 1 - over;
    // Only an UPCOMING game identifies the slate this entry is for; the off-season
    // last-completed-game fallback would group legs from unrelated past games.
    const m = r.data?.matchupOpponent ?? null;
    const gameId = m?.isUpcoming ? (m.gameExternalId ?? null) : null;
    return { prop, pHit, loading: r.isPending, gameId };
  });

  // Selection: legs the user has ticked into the entry (keyed by prop identity).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const legKey = (p: SavedProp) => `${p.slug}:${p.stat}:${p.side}`;
  const toggle = (p: SavedProp) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const k = legKey(p);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const chosenLegs = legs.filter((l) => selected.has(legKey(l.prop)));
  // Only legs with a known probability can be priced.
  const priced = chosenLegs.filter((l): l is Leg & { pHit: number } => l.pHit != null);
  const anyLoadingSelected = chosenLegs.some((l) => l.loading);
  const ps = priced.map((l) => l.pHit);
  const evs = ps.length >= MIN_LEGS && ps.length <= MAX_LEGS ? entryEvs(ps) : [];
  const avg = avgLegProb(ps);

  // Correlation among the PRICED legs — the ones the EV above actually multiplies
  // together as if they were independent.
  const correlation = correlationWarning(
    priced.map((l) => ({ slug: l.prop.slug, sport: l.prop.sport, gameId: l.gameId })),
  );
  const showCorrelation = hasCorrelation(correlation);
  const samePlayerSlugs = correlatedLegKeys({ ...correlation, sameGame: [] }, (l) => l.slug);
  const sameGameSlugs = correlatedLegKeys({ ...correlation, samePlayer: [] }, (l) => l.slug);

  if (eligibleProps.length < MIN_LEGS) {
    return null; // not enough PrizePicks standard legs to build any entry
  }

  return (
    <section
      aria-label="PrizePicks entry calculator"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">PrizePicks entry calculator</h2>
        <span className="text-xs text-muted">
          {selected.size === 0
            ? `Pick ${MIN_LEGS}–${MAX_LEGS} legs`
            : `${priced.length} leg${priced.length === 1 ? '' : 's'} priced`}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Tick your saved PrizePicks legs to see what a Power or Flex entry pays, priced off
        each leg&rsquo;s model win probability.
      </p>

      <ul className="mt-3 space-y-1">
        {legs.map((l) => {
          const k = legKey(l.prop);
          const on = selected.has(k);
          const def = STAT_DEFS[l.prop.stat];
          // Only mark a leg that is actually in the entry being priced.
          const tag = !on
            ? null
            : samePlayerSlugs.has(l.prop.slug)
              ? { label: 'same player', title: 'Another selected leg is on this same player — the two move together.' }
              : sameGameSlugs.has(l.prop.slug)
                ? { label: 'same game', title: 'Another selected leg is in this same game — the two move together.' }
                : null;
          return (
            <li key={k}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(l.prop)}
                  disabled={l.pHit == null && !l.loading}
                  className="accent-brand"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{l.prop.name}</span>{' '}
                  <span className="text-muted">
                    <span className={leanTextClass(l.prop.side)}>
                      {l.prop.side === 'over' ? 'Over' : 'Under'}
                    </span>{' '}
                    <span className="tabular-nums">{l.prop.line}</span> {def.short}
                  </span>
                  {tag && (
                    <span
                      title={tag.title}
                      className="ml-1.5 whitespace-nowrap rounded-full border border-current px-1.5 py-px text-[10px] font-medium text-sig-amber"
                    >
                      {tag.label}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {l.loading ? '…' : l.pHit == null ? 'no read' : `${pct(l.pHit)} hit`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          {priced.length < MIN_LEGS ? (
            <p className="text-xs text-muted">
              Select at least {MIN_LEGS} priced legs{anyLoadingSelected ? ' (some are still loading)' : ''}.
            </p>
          ) : priced.length > MAX_LEGS ? (
            <p className="text-xs text-muted">
              PrizePicks entries are {MIN_LEGS}–{MAX_LEGS} legs — deselect {priced.length - MAX_LEGS}.
            </p>
          ) : (
            <>
              <div className="mb-2 text-xs text-muted">
                {priced.length}-leg entry · legs average{' '}
                <span className="font-semibold text-foreground tabular-nums">{pct(avg)}</span> to hit
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {evs.map((e) => (
                  <EntryEvCard key={e.type} ev={e} avg={avg} />
                ))}
              </div>
              {/* Sits directly under the EV cards, because it is a caveat ON those
                  numbers: they multiply the legs as if independent, and these ones
                  aren't. We flag it rather than re-price it — a joint model built
                  from public game logs would be a guess dressed up as precision. */}
              {showCorrelation && (
                <div
                  role="note"
                  className="mt-2 rounded-lg border border-line bg-surface-2 p-2.5 text-[11px] leading-relaxed"
                >
                  <span className="font-semibold text-sig-amber">Correlated legs</span>
                  <span className="text-muted">
                    {' — '}
                    {[
                      correlation.samePlayer.length === 1
                        ? 'two or more legs are on the same player'
                        : correlation.samePlayer.length > 1
                          ? `${correlation.samePlayer.length} players each carry more than one leg`
                          : null,
                      correlation.sameGame.length === 1
                        ? 'two or more legs share a game'
                        : correlation.sameGame.length > 1
                          ? `${correlation.sameGame.length} games each carry more than one leg`
                          : null,
                    ]
                      .filter(Boolean)
                      .join(', and ')}
                    . The EV above multiplies every leg as an independent event, so a
                    sweep is <strong>less likely</strong> than it shows (and a partial-pay
                    Flex miss is more likely to come in bunches). Spreading across games
                    keeps the math above closer to the truth.
                  </span>
                </div>
              )}
              {/* The one CTA in the Playbook, and it only appears once the user has
                  a fully priced entry in front of them — at that point "go build
                  it" is the actual next step, not an interruption. */}
              <p className="mt-3 text-xs text-muted">
                <BookLink source="prizepicks" placement="playbook-entry" className="font-semibold text-brand hover:text-brand-strong">
                  Build this entry on PrizePicks →
                </BookLink>
              </p>
              <AffiliateDisclosure variant="inline" />
            </>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Model math, not advice. Legs are treated as <strong>independent</strong> — same-game
        or same-player legs are correlated in reality, which makes a sweep less certain than
        shown (we flag those legs above, but the EV is not adjusted for them). Win
        probabilities are estimates from historical game logs, and payout multiples
        are typical PrizePicks values (they vary by state/promo). Descriptive research — never a
        prediction or a bet recommendation.
      </p>
    </section>
  );
}

function EntryEvCard({ ev, avg }: { ev: EntryEv; avg: number }) {
  const positive = ev.ev >= 0;
  const clears = avg >= ev.breakevenPerLeg;
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold capitalize">{ev.type} Play</span>
        <span className={`text-sm font-bold tabular-nums ${positive ? 'text-over' : 'text-under'}`}>
          {positive ? '+' : ''}
          {(ev.ev * 100).toFixed(0)}% EV
        </span>
      </div>
      <dl className="mt-1.5 space-y-0.5 text-[11px] text-muted">
        <div className="flex justify-between">
          <dt>All hit ({ev.pays.allHit}×)</dt>
          <dd className="tabular-nums">{pct(ev.pAll)}</dd>
        </div>
        {ev.pays.oneMiss != null && (
          <div className="flex justify-between">
            <dt>One miss ({ev.pays.oneMiss}×)</dt>
            <dd className="tabular-nums">partial pay</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Breakeven / leg</dt>
          <dd className={`tabular-nums ${clears ? 'text-over' : 'text-under'}`}>
            {pct(ev.breakevenPerLeg)}
          </dd>
        </div>
      </dl>
      <p className="mt-1.5 text-[10px] leading-snug text-muted">
        {clears
          ? `Your legs average above the ${pct(ev.breakevenPerLeg)} each this entry needs.`
          : `Your legs average below the ${pct(ev.breakevenPerLeg)} each this entry needs.`}
      </p>
    </div>
  );
}
