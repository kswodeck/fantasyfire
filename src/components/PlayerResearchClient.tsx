'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { PlayerResearch } from '@/lib/types';
import { STAT_DEFS, statKeysForSport, altLineTable, type StatKey } from '@/lib/stats';
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
import { AltLineExplorer } from './AltLineExplorer';
import { GameBarChart } from './GameBarChart';
import { DvpBlock } from './DvpBlock';
import { WhyReadout } from './WhyReadout';
import { ParkFactorNote } from './ParkFactorNote';
import { VerdictPanel } from './VerdictPanel';
import { AvailabilityBanner } from './AvailabilityBanner';
import { MarketEdgePanel } from './MarketEdgePanel';
import { SavePropControl } from './SavePropControl';
import { SplitsPanel } from './SplitsPanel';
import { TeammateSplitsPanel } from './TeammateSplitsPanel';
import { LineValueTable } from './LineValueTable';
import { SourceSelector } from './SourceSelector';
import { VariantLadder } from './VariantLadder';
import { VariantChips } from './VariantChips';
import { PayoutBadge } from './PayoutBadge';
import { useSelectedSource } from './SelectedSourceProvider';
import { sourceLabel } from '@/lib/providedSources';
import { isOverOnly } from '@/lib/payoutVariant';

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
  statHrefBase,
  availableSources = [],
  initialSource,
}: {
  slug: string;
  initialResearch: PlayerResearch;
  initialStat: StatKey;
  /** When set (the per-stat SEO page), switching stats navigates to the player
   * hub at this path with ?stat= instead of swapping in place — keeping the URL,
   * header, and content in sync. */
  statHrefBase?: string;
  /** Books with lines for this sport (drives the source dropdown). [] hides it. */
  availableSources?: string[];
  /** The book the SSR payload's line came from (default selection). */
  initialSource: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sport = initialResearch.player.sport;
  const statKeys = statKeysForSport(sport, initialResearch.player.posBucket);
  const [stat, setStat] = useState<StatKey>(initialStat);
  const [line, setLine] = useState<number | undefined>(undefined);
  const [source, setSource] = useState<string>(initialSource);
  const [overOdds, setOverOdds] = useState<number | null>(null);
  const [underOdds, setUnderOdds] = useState<number | null>(null);
  const [edgeWindow, setEdgeWindow] = useState<string>('season');
  const { source: globalSource, setSource: setGlobalSource } = useSelectedSource();
  // True when the URL pinned a book (?source=…): a shared link must open on the book
  // it was shared from, so the visitor's own saved choice doesn't override it.
  const urlPinnedSource = useRef(false);

  // Hydrate stat/line/source from the URL once on mount — syncing from an external
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
    const srcP = params.get('source');
    if (srcP !== null && availableSources.includes(srcP)) {
      urlPinnedSource.current = true;
      if (srcP !== initialSource) setSource(srcP);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default the book to the user's saved choice (persisted across pages) when this
  // sport offers it — keeps the selected source consistent everywhere. A book pinned
  // by the URL wins over the saved choice for this page view.
  useEffect(() => {
    if (urlPinnedSource.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (globalSource !== source && availableSources.includes(globalSource)) setSource(globalSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSource]);

  // Seed React Query with the SSR payload ONLY for the initial stat/line key.
  // Passing it for other keys would (with staleTime) make the previous stat's
  // data look fresh and suppress the refetch.
  const isInitialKey = stat === initialStat && line === undefined && source === initialSource;
  const query = useHitRate({
    sport,
    slug,
    stat,
    line,
    source,
    initialData: isInitialKey ? initialResearch : undefined,
  });
  const data = query.data ?? initialResearch;

  function syncUrl(nextStat: StatKey, nextLine: number | undefined, nextSource: string) {
    const params = new URLSearchParams();
    params.set('stat', nextStat);
    if (nextLine !== undefined) params.set('line', String(nextLine));
    // Record the book too (when it isn't the server default), so a copied URL opens
    // on the same book — not on whatever the next visitor last had selected.
    if (nextSource !== initialSource) params.set('source', nextSource);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  }

  function handleStat(next: StatKey) {
    track('stat_switched', { sport, stat: next });
    if (statHrefBase) {
      // On the per-stat page, switching stats is a real navigation to the hub.
      const src = source !== initialSource ? `&source=${source}` : '';
      router.push(`${statHrefBase}?stat=${next}${src}`);
      return;
    }
    setStat(next);
    setLine(undefined); // reset to the new stat's default line
    syncUrl(next, undefined, source);
  }

  function handleLine(next: number) {
    setLine(next);
    syncUrl(stat, next, source);
    track('line_entered', { sport, stat });
  }

  function handleSource(next: string) {
    setSource(next);
    setGlobalSource(next); // persist the choice + sync it across pages
    setLine(undefined); // show the new book's line, not a stale custom line
    syncUrl(stat, undefined, next);
    track('source_switched', { sport, source: next });
  }

  function handleOdds(side: 'over' | 'under', value: number | null) {
    if (side === 'over') setOverOdds(value);
    else setUnderOdds(value);
    if (value !== null) track('fairprice_used', { sport });
  }

  const statDef = STAT_DEFS[data.stat];
  const effectiveLine = line ?? data.line;
  // Demon/goblin/alternate lines only pay the over (the server pins the verdict side
  // the same way) — gate the under-odds input + fair-price math to match. A custom
  // line that matches no book rung comes back with a null oddsType → both sides.
  const overOnly = data.oddsType != null && isOverOnly(data.oddsType);
  // Where the shown line comes from: the user's own entry, the chosen book, or our
  // computed line (when that book has no line for this player+stat).
  const lineSourceLabel =
    line !== undefined
      ? 'your line'
      : data.lineSource
        ? `${sourceLabel(data.lineSource)} line`
        : availableSources.length > 0
          ? 'our line'
          : null;
  const seasonWindow = data.windows.find((w) => w.window === 'season');
  const seasonOver = seasonWindow?.hitRate.hitRateOver ?? null;
  // Alt-line table is line-independent (values don't move), so it recomputes on
  // the client as the user nudges the line — no refetch needed.
  const altRows = altLineTable(seasonWindow?.hitRate.values ?? [], effectiveLine);
  const edgeOver =
    data.windows.find((w) => w.window === edgeWindow)?.hitRate.hitRateOver ?? null;

  // An over-only line ignores any under price left over from a previous selection.
  const effectiveUnderOdds = overOnly ? null : underOdds;
  const hasOdds = cleanOdds(overOdds) !== null || cleanOdds(effectiveUnderOdds) !== null;
  let readout = null;
  if (hasOdds) {
    try {
      readout = fairPriceReadout({
        overOdds: cleanOdds(overOdds),
        underOdds: cleanOdds(effectiveUnderOdds),
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
            {/* One-click variant switcher (same chips as the board rows) — click a
                demon/goblin/alternate to funnel through it, click again to walk the
                ladder and return to the standard line. The full ladder below shows
                every rung with its own read. */}
            <VariantChips variants={data.variants} line={effectiveLine} onSelect={handleLine} />
            {/* Payout tag whenever the current line matches a book rung — auto-picked
                OR selected via the chips/ladder (a hand-typed off-book number has none). */}
            <PayoutBadge oddsType={data.oddsType} multiplier={data.multiplier} />
          </div>
          {availableSources.length > 0 && (
            <SourceSelector sources={availableSources} value={source} onChange={handleSource} />
          )}
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
        <SavePropControl
          sport={sport}
          slug={slug}
          name={data.player.fullName}
          team={data.player.teamAbbreviation}
          stat={stat}
          line={effectiveLine}
          source={source}
          oddsType={data.oddsType}
          multiplier={data.multiplier}
          // Stamp the upcoming game so the pick auto-expires once it's over.
          // The fallback (off-season "last game") isn't a future game — leave null.
          gameDate={data.matchupOpponent?.isUpcoming ? data.matchupOpponent.date : null}
          gameStartTime={data.matchupOpponent?.isUpcoming ? data.matchupOpponent.startTime : null}
        />
      </div>

      {/* Payout-variant ladder for the chosen book (PrizePicks demon/goblin, Underdog
          alternates) — picking a rung recomputes the read at that line. */}
      <VariantLadder
        variants={data.variants}
        selectedLine={effectiveLine}
        statShort={statDef.short}
        sourceId={source}
        onSelect={handleLine}
        seasonValues={seasonWindow?.hitRate.values ?? []}
      />

      {/* Injury / availability — gates the read when the player is Out */}
      {data.availability && (
        <AvailabilityBanner availability={data.availability} playerName={data.player.fullName} />
      )}

      {/* Verdict — the FireFactor "good prop" read + sub-signals */}
      <VerdictPanel verdict={data.verdict} statShort={statDef.short} line={data.line} />

      {/* Hit-rate cards */}
      <section aria-label="Hit rates" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.windows.map((w) => (
          <HitRateCard key={w.window} result={w} />
        ))}
      </section>

      {/* Alternate lines — how the over rate moves around the selected line; click one
          to funnel the full read (verdict, charts, splits) through that number. Hidden
          whenever the payout-variant ladder above renders (2+ rungs): the ladder shows
          the same nearby lines with their over rates AND the payout context, so this
          section would just repeat it. */}
      {!(data.variants && data.variants.length >= 2) && (
        <AltLineExplorer rows={altRows} statShort={statDef.short} onSelect={handleLine} />
      )}

      {/* Chart */}
      <section aria-label="Game-by-game" className="mb-6">
        <GameBarChart points={data.chart} line={data.line} statShort={statDef.short} />
      </section>

      {/* Situational splits */}
      <SplitsPanel splits={data.splits} statShort={statDef.short} line={data.line} />

      {/* Injury cascade — line shift when an impactful teammate is out */}
      <TeammateSplitsPanel splits={data.teammateSplits} statShort={statDef.short} line={data.line} />

      {/* Matchup + read */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <DvpBlock
          dvp={data.dvp}
          opponentAbbreviation={data.matchupOpponent?.abbreviation ?? null}
          opponentExternalId={data.matchupOpponent?.externalId ?? null}
          matchupDate={data.matchupOpponent?.date ?? null}
          matchupStartTime={data.matchupOpponent?.startTime ?? null}
          isHome={data.matchupOpponent?.isHome ?? null}
          isUpcoming={data.matchupOpponent?.isUpcoming ?? null}
          gameHref={
            data.matchupOpponent?.isUpcoming && data.matchupOpponent.gameExternalId
              ? `/${sport}/game/${data.matchupOpponent.gameExternalId}`
              : null
          }
          sport={sport}
        />
        <WhyReadout text={data.why} />
        {sport === 'mlb' && (
          <ParkFactorNote
            teamExternalId={data.player.teamExternalId}
            teamName={data.player.teamName}
          />
        )}
      </section>

      {/* Market edge — automated no-vig consensus + best price / +EV from the books we
          track (only when a sportsbook posted two-sided odds for this prop). */}
      {data.verdict.marketConsensus && (
        <div className="mb-6">
          <MarketEdgePanel
            consensus={data.verdict.marketConsensus}
            statShort={statDef.short}
            modelProbOver={data.verdict.modelProbOver}
          />
        </div>
      )}

      {/* Line shopping — best number across books (sits above the fair-price calculator;
          updates live with the stat/book since it reads the current research). Clicking
          a book's row switches the whole read to that book — same as the dropdown. */}
      {data.lineValue && (
        <LineValueTable
          data={data.lineValue}
          statShort={statDef.short}
          selectableSources={availableSources}
          onSelectSource={handleSource}
        />
      )}

      {/* Odds -> fair price */}
      <section className="mb-6 space-y-4 rounded-xl border border-line bg-surface-2 p-4">
        <div>
          <h3 className="text-sm font-semibold">Fair-price calculator</h3>
          <p className="mt-1 text-xs text-muted">
            Enter the book&apos;s American odds to see implied probability, the no-vig
            fair price, and the edge vs. this player&apos;s season hit rate.
            {overOnly && (
              <>
                {' '}
                This demon/goblin/alternate line pays the over only — no under to price.
              </>
            )}
          </p>
        </div>
        <OddsInputs
          over={overOdds}
          under={effectiveUnderOdds}
          onChange={handleOdds}
          allowUnder={!overOnly}
        />
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
