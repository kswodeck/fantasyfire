'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import type { BoardRow, PlayerResearch } from '@/lib/types';
import { STAT_DEFS, statKeysForSport, altLineTable, type StatKey } from '@/lib/stats';
import { statKeySchema, lineSchema } from '@/lib/schemas';
import { fairPriceReadout } from '@/lib/odds';
import { num1, pct } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useHitRate } from '@/hooks/useHitRate';
import { useTopReads } from '@/hooks/useTopReads';
import { PlayerTopReads } from './PlayerTopReads';
import { StatSelector } from './StatSelector';
import { LineInput } from './LineInput';
import { OddsInputs } from './OddsInputs';
import { FairPriceReadout } from './FairPriceReadout';
import { HitRateCard } from './HitRateCard';
import { WhyReadout } from './WhyReadout';
import { ParkFactorNote } from './ParkFactorNote';
import { VerdictPanel } from './VerdictPanel';
import { AvailabilityBanner } from './AvailabilityBanner';
import { MarketEdgePanel } from './MarketEdgePanel';
import { SavePropControl } from './SavePropControl';
import { SourceSelector } from './SourceSelector';
import { VariantLadder } from './VariantLadder';
import { VariantChips } from './VariantChips';
import { PayoutBadge } from './PayoutBadge';
import { useSelectedSource } from './SelectedSourceProvider';
import { BookLink } from './BookLink';
import { isOverOnly } from '@/lib/payoutVariant';

// Below-the-fold panels are code-split so the verdict above the fold hydrates
// without their JS. They still render on the server (SSR HTML is unchanged for
// SEO); only the client chunks load lazily.
const AltLineExplorer = dynamic(() =>
  import('./AltLineExplorer').then((m) => m.AltLineExplorer),
);
const GameBarChart = dynamic(() => import('./GameBarChart').then((m) => m.GameBarChart));
const DvpBlock = dynamic(() => import('./DvpBlock').then((m) => m.DvpBlock));
const SplitsPanel = dynamic(() => import('./SplitsPanel').then((m) => m.SplitsPanel));
const TeammateSplitsPanel = dynamic(() =>
  import('./TeammateSplitsPanel').then((m) => m.TeammateSplitsPanel),
);
const LineValueTable = dynamic(() =>
  import('./LineValueTable').then((m) => m.LineValueTable),
);

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
  initialTopReads,
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
  /** SSR seed for the "top reads" mini dashboard (computed for initialSource). */
  initialTopReads?: BoardRow[];
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
  // The payout context of the rung selected via the chips/ladder/top-reads, captured
  // AT CLICK TIME — so the refetch stays anchored to that payout even if the book
  // re-prices/pulls the rung mid-session (see RungHint on the server).
  const [rungHint, setRungHint] = useState<
    { oddsType?: string | null; multiplier?: number | null } | undefined
  >(undefined);

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
    oddsType: line !== undefined ? rungHint?.oddsType : undefined,
    multiplier: line !== undefined ? rungHint?.multiplier : undefined,
    initialData: isInitialKey ? initialResearch : undefined,
  });
  const data = query.data ?? initialResearch;

  // The "top reads" mini dashboard — this player's strongest prop+line combos for
  // the chosen book. Seeded from SSR for the initial source; refetches per source.
  const topReads = useTopReads({
    sport,
    slug,
    source,
    initialData: source === initialSource ? initialTopReads : undefined,
  });

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
    setRungHint(undefined);
    syncUrl(next, undefined, source);
  }

  function handleLine(next: number) {
    // Capture the clicked rung's payout context from the ladder AS RENDERED — the
    // refetch this triggers must score against the payout the user saw, even if
    // the book has since moved/pulled the rung.
    const rung = data.variants?.find((v) => v.line === next);
    setRungHint(rung ? { oddsType: rung.oddsType, multiplier: rung.multiplier } : undefined);
    setLine(next);
    syncUrl(stat, next, source);
    track('line_entered', { sport, stat });
  }

  // A "top reads" pick loads that prop+line into the whole page — same effect as
  // choosing the stat then typing the line. On the per-stat SEO page it navigates
  // to the hub (like handleStat) with the line pinned in the URL.
  function handlePick(nextStat: StatKey, nextLine: number, hint?: { oddsType?: string | null; multiplier?: number | null }) {
    track('top_read_clicked', { sport, stat: nextStat });
    if (nextStat === stat) {
      // Same stat — just move the line (no navigation even on the per-stat page).
      setRungHint(hint);
      setLine(nextLine);
      syncUrl(stat, nextLine, source);
      return;
    }
    if (statHrefBase) {
      const src = source !== initialSource ? `&source=${source}` : '';
      router.push(`${statHrefBase}?stat=${nextStat}&line=${nextLine}${src}`);
      return;
    }
    setStat(nextStat);
    setRungHint(hint);
    setLine(nextLine);
    syncUrl(nextStat, nextLine, source);
  }

  function handleSource(next: string) {
    setSource(next);
    setGlobalSource(next); // persist the choice + sync it across pages
    setLine(undefined); // show the new book's line, not a stale custom line
    setRungHint(undefined);
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
  // When the number came from a BOOK, its name links out to that book (a referral
  // link where one is configured). This is the site's highest-intent moment — the
  // user has drilled to one player, one stat, one line — so it's the one place a
  // link is genuinely useful rather than an interruption. 'your line' / 'our line'
  // stay plain text: there's nothing to link to.
  const lineSourceLabel =
    line !== undefined ? (
      'your line'
    ) : data.lineSource ? (
      <>
        <BookLink source={data.lineSource} placement="player-line" /> line
      </>
    ) : availableSources.length > 0 ? (
      'our line'
    ) : null;
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
      {/* Top reads — the strongest prop+line combos for this player + matchup,
          each one click away from becoming the page's selected prop/line. */}
      <PlayerTopReads
        rows={topReads.data}
        currentStat={stat}
        currentLine={effectiveLine}
        onPick={handlePick}
      />

      {/* Controls */}
      <div className="mb-5 space-y-3 rounded-xl border border-line bg-surface-2 p-4">
        <StatSelector value={stat} keys={statKeys} onChange={handleStat} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* flex-wrap: on a phone this row (label + stepper + variant chips + the
              payout badge) is wider than the card, and without it the badge had
              nowhere to go and overflowed the container's right edge. */}
          <div className="flex flex-wrap items-center gap-2">
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
            {/* Provenance of the number being analyzed — the user should never have
                to guess whether this is their entry, a book's line, or our default. */}
            {lineSourceLabel && <> · {lineSourceLabel}</>}
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
        statLabel={statDef.label}
        sourceId={source}
        onSelect={handleLine}
        seasonValues={seasonWindow?.hitRate.values ?? []}
      />

      {/* Injury / availability — gates the read when the player is Out */}
      {data.availability && (
        <AvailabilityBanner availability={data.availability} playerName={data.player.fullName} />
      )}

      {/* Verdict — the FireFactor "good prop" read + sub-signals */}
      <VerdictPanel
        verdict={data.verdict}
        statShort={statDef.short}
        statLabel={statDef.label}
        line={data.line}
      />

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
        <AltLineExplorer
          rows={altRows}
          statShort={statDef.short}
          statLabel={statDef.label}
          onSelect={handleLine}
        />
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
          statLabel={statDef.label}
          selectableSources={availableSources}
          onSelectSource={handleSource}
          currentSource={source}
        />
      )}

      {/* Odds -> fair price */}
      <section className="mb-6 space-y-4 rounded-xl border border-line bg-surface-2 p-4">
        <div>
          <h2 className="text-sm font-semibold">Fair-price calculator</h2>
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
