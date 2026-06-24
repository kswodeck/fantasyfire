'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { PlayerResearch } from '@/lib/types';
import { STAT_DEFS, statKeysForSport, type StatKey } from '@/lib/stats';
import { statKeySchema, lineSchema } from '@/lib/schemas';
import { fairPriceReadout } from '@/lib/odds';
import { num1, pct } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useHitRate } from '@/hooks/useHitRate';
import { StatSelector } from './StatSelector';
import { LineInput } from './LineInput';
import { OddsInputs } from './OddsInputs';
import { FairPriceReadout } from './FairPriceReadout';
import { HitRateCard } from './HitRateCard';
import { GameBarChart } from './GameBarChart';
import { DvpBlock } from './DvpBlock';
import { WhyReadout } from './WhyReadout';
import { VerdictPanel } from './VerdictPanel';
import { SplitsPanel } from './SplitsPanel';

/** Sanitize raw odds: treat 0 / non-finite as "not entered". */
function cleanOdds(x: number | null): number | null {
  return x === null || x === 0 || !Number.isFinite(x) ? null : x;
}

const WINDOW_LABELS: Record<string, string> = {
  '5': 'L5',
  '10': 'L10',
  '20': 'L20',
  season: 'Season',
};
const EDGE_WINDOWS = ['5', '10', '20', 'season'];

export function PlayerResearchClient({
  slug,
  initialResearch,
  initialStat,
}: {
  slug: string;
  initialResearch: PlayerResearch;
  initialStat: StatKey;
}) {
  const pathname = usePathname();
  const sport = initialResearch.player.sport;
  const statKeys = statKeysForSport(sport, initialResearch.player.posBucket);
  const [stat, setStat] = useState<StatKey>(initialStat);
  const [line, setLine] = useState<number | undefined>(undefined);
  const [overOdds, setOverOdds] = useState<number | null>(null);
  const [underOdds, setUnderOdds] = useState<number | null>(null);
  const [edgeWindow, setEdgeWindow] = useState<string>('season');

  // Hydrate stat/line from the URL once on mount — syncing from an external
  // system (the URL) into React. Done in an effect (not a lazy initializer) so
  // SSR and the first client render agree (no hydration mismatch on the active
  // chip); the URL-derived values are applied right after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sp = statKeySchema.safeParse(params.get('stat') ?? undefined);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sp.success && statKeys.includes(sp.data) && sp.data !== initialStat) setStat(sp.data);
    const lp = params.get('line');
    if (lp !== null) {
      const parsed = lineSchema.safeParse(lp);
      if (parsed.success) setLine(parsed.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed React Query with the SSR payload ONLY for the initial stat/line key.
  // Passing it for other keys would (with staleTime) make the previous stat's
  // data look fresh and suppress the refetch.
  const isInitialKey = stat === initialStat && line === undefined;
  const query = useHitRate({
    sport,
    slug,
    stat,
    line,
    initialData: isInitialKey ? initialResearch : undefined,
  });
  const data = query.data ?? initialResearch;

  function syncUrl(nextStat: StatKey, nextLine: number | undefined) {
    const params = new URLSearchParams();
    params.set('stat', nextStat);
    if (nextLine !== undefined) params.set('line', String(nextLine));
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  }

  function handleStat(next: StatKey) {
    setStat(next);
    setLine(undefined); // reset to the new stat's default line
    syncUrl(next, undefined);
    track('stat_switched', { sport, stat: next });
  }

  function handleLine(next: number) {
    setLine(next);
    syncUrl(stat, next);
    track('line_entered', { sport, stat });
  }

  function handleOdds(side: 'over' | 'under', value: number | null) {
    if (side === 'over') setOverOdds(value);
    else setUnderOdds(value);
    if (value !== null) track('fairprice_used', { sport });
  }

  const statDef = STAT_DEFS[data.stat];
  const effectiveLine = line ?? data.line;
  const seasonOver = data.windows.find((w) => w.window === 'season')?.hitRate.hitRateOver ?? null;
  const edgeOver =
    data.windows.find((w) => w.window === edgeWindow)?.hitRate.hitRateOver ?? null;

  const hasOdds = cleanOdds(overOdds) !== null || cleanOdds(underOdds) !== null;
  let readout = null;
  if (hasOdds) {
    try {
      readout = fairPriceReadout({
        overOdds: cleanOdds(overOdds),
        underOdds: cleanOdds(underOdds),
        historicalHitRateOver: edgeOver,
      });
    } catch {
      readout = null;
    }
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-5 space-y-3 rounded-xl border border-line bg-surface-2 p-4">
        <StatSelector value={stat} keys={statKeys} onChange={handleStat} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Line</span>
            <LineInput value={effectiveLine} onCommit={handleLine} />
          </div>
          <span className="text-sm text-muted">
            {statDef.label}
            {data.seasonAverage !== null && (
              <> · season avg {num1(data.seasonAverage)} {statDef.short}</>
            )}
          </span>
          {query.isFetching && (
            <span className="ml-auto animate-pulse text-xs text-brand">updating…</span>
          )}
        </div>
      </div>

      {/* Verdict — the FireScore "good prop" read + sub-signals */}
      <VerdictPanel verdict={data.verdict} statShort={statDef.short} line={data.line} />

      {/* Hit-rate cards */}
      <section aria-label="Hit rates" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.windows.map((w) => (
          <HitRateCard key={w.window} result={w} />
        ))}
      </section>

      {/* Chart */}
      <section aria-label="Game-by-game" className="mb-6">
        <GameBarChart points={data.chart} line={data.line} statShort={statDef.short} />
      </section>

      {/* Situational splits */}
      <SplitsPanel splits={data.splits} statShort={statDef.short} line={data.line} />

      {/* Matchup + read */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <DvpBlock
          dvp={data.dvp}
          opponentAbbreviation={data.recentOpponent?.abbreviation ?? null}
          isHome={data.recentOpponent?.isHome ?? null}
          sport={sport}
        />
        <WhyReadout text={data.why} />
      </section>

      {/* Odds -> fair price */}
      <section className="mb-6 space-y-4 rounded-xl border border-line bg-surface-2 p-4">
        <div>
          <h3 className="text-sm font-semibold">Fair-price calculator</h3>
          <p className="mt-1 text-xs text-muted">
            Enter the book&apos;s American odds to see implied probability, the no-vig
            fair price, and the edge vs. this player&apos;s season hit rate.
          </p>
        </div>
        <OddsInputs over={overOdds} under={underOdds} onChange={handleOdds} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Edge vs</span>
          {EDGE_WINDOWS.map((w) => {
            const active = w === edgeWindow;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setEdgeWindow(w)}
                aria-pressed={active}
                className={
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ' +
                  (active
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'border-line bg-surface text-muted hover:text-foreground')
                }
              >
                {WINDOW_LABELS[w]}
              </button>
            );
          })}
        </div>
        {readout && (
          <FairPriceReadout
            readout={readout}
            historicalHitRate={edgeOver}
            historicalLabel={`${WINDOW_LABELS[edgeWindow]} hit rate (over)`}
          />
        )}
      </section>

      <p className="text-xs text-muted">
        Hit rate excludes pushes from the denominator. Confidence uses a 95% Wilson
        interval — a high recent rate on few games still reads as low confidence.
        {seasonOver !== null && <> Season over rate at this line: {pct(seasonOver)}.</>}
      </p>
    </div>
  );
}
