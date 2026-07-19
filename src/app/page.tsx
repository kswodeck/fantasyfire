import Link from 'next/link';
import { FlameMark } from '@/components/FlameMark';
import { HomeTopLeans, type HomeCard } from '@/components/HomeTopLeans';
import { getBoard, getSourcedBoards, getTonightSlate, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources, providedLinesEnabled } from '@/lib/server/providedLines';
import { SITE } from '@/lib/site';
import { SPORT_LIST, SPORTS, type Sport } from '@/lib/sports';
import { socialDayIso } from '@/lib/social/schedule';
import type { BoardRow, TonightGame } from '@/lib/types';

export const revalidate = 900; // 15 min — matches the lines ingest cadence, bounding board↔player-page score skew to one cycle

function slateTeams(games: TonightGame[]): Set<string> {
  return new Set(
    games.flatMap((g) => [g.home.abbr, g.away.abbr]).filter((a): a is string => !!a),
  );
}

/** Teaser rows shown per sport card. */
const TEASER_ROWS = 4;

async function loadSport(sport: Sport): Promise<{
  boardsBySource: Record<string, BoardRow[]>;
  medianLeans: BoardRow[];
  /** False when the sport's next slate isn't TODAY — the card is hidden entirely
   *  (a sport with no games today has nothing actionable to tease). */
  hasGamesToday: boolean;
}> {
  // A taste of each book's top reads, switched by the page-wide site source selector
  // (our median line only when no book lines are ingested). The teaser defaults to
  // PLAYERS WITH GAMES TODAY — filtered server-side against the slate, since the
  // card has no toggle. We pull deeper than the rows we show so the filter still
  // yields a full teaser.
  const [sources, slate] = await Promise.all([
    getAvailableSources(sport).catch(() => [] as string[]),
    getTonightSlate(sport).catch(() => ({ date: null, games: [] as TonightGame[] })),
  ]);
  // getTonightSlate anchors on the SOONEST slate on/after today — which can be days
  // out (a weekend-only league midweek). No games today → skip the card AND the
  // heavy board scan; the sport is one nav tap away, and an empty teaser sells
  // nothing. "Today" is the SOCIAL DAY (11pm-ET rollover — schedule.ts), the
  // same convention getTonightSlate labels with.
  const todayIso = socialDayIso(new Date());
  const hasGamesToday = slate.games.length > 0 && slate.date === todayIso;
  if (!hasGamesToday) return { boardsBySource: {}, medianLeans: [], hasGamesToday };
  const teams = slateTeams(slate.games);
  // The teaser sells the strongest reads — a "No read" row on the home page is
  // pure noise (same filter as the per-game page).
  const isRead = (r: BoardRow) =>
    r.fireScore.tier !== 'Pass' && r.fireScore.tier !== 'No lean';
  const onSlate = (rows: BoardRow[]): BoardRow[] =>
    teams.size === 0
      ? rows.filter(isRead).slice(0, TEASER_ROWS)
      : rows
          .filter(
            (r) =>
              isRead(r) && r.player.teamAbbreviation && teams.has(r.player.teamAbbreviation),
          )
          .slice(0, TEASER_ROWS);
  // Only 4 rows are shown per card (after the today's-slate filter), so scan a
  // smaller pool than the board default (120) — a big egress cut on the home path
  // (every active sport, every 15-min regen) with ample headroom to still fill 4.
  if (sources.length > 0) {
    const boards = await getSourcedBoards(sport, sources, {
      limit: 24,
      scan: 60,
      standardOnly: true,
    }).catch(() => ({}) as Record<string, BoardRow[]>);
    const boardsBySource: Record<string, BoardRow[]> = {};
    for (const [s, rows] of Object.entries(boards)) boardsBySource[s] = onSlate(rows);
    return { boardsBySource, medianLeans: [], hasGamesToday };
  }
  const medianLeans = onSlate(
    await getBoard(sport, { limit: 24, scan: 60 }).catch(() => [] as BoardRow[]),
  );
  return { boardsBySource: {}, medianLeans, hasGamesToday };
}

export default async function Home() {
  // Only surface sports with GAMES TODAY — off-season sports have nothing
  // actionable, and an in-season sport whose next slate is days away (a
  // weekend-only league midweek) would render an empty teaser. hasUpcomingGames
  // is the cheap first gate; loadSport then confirms the slate is today's.
  // DB unavailable → no sports (the no-slate empty state), never a 500.
  const activeSports = (
    await Promise.all(
      SPORT_LIST.map(async (s) => ((await hasUpcomingGames(s).catch(() => false)) ? s : null)),
    )
  ).filter((s): s is Sport => s !== null);

  const loaded = (
    await Promise.all(activeSports.map(async (s) => [s, await loadSport(s)] as const))
  ).filter(([, d]) => d.hasGamesToday);
  const cards: HomeCard[] = loaded.map(([sport, d]) => {
    const cfg = SPORTS[sport];
    return {
      sport,
      name: cfg.name,
      accent: cfg.accent,
      tagline: cfg.tagline,
      boardsBySource: d.boardsBySource,
      medianLeans: d.medianLeans,
    };
  });

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
        <section className="flex flex-col items-center gap-6 py-14 text-center">
          <FlameMark className="h-14 w-14 text-brand" />
          {/* Two deliberate lines: the brand phrase leads, flame-gradient and a size
              up; the qualifier sits under it in plain foreground. (No awkward
              mid-phrase wrap like "…player / prop".) */}
          <h1 className="max-w-2xl font-bold tracking-tight">
            <span className="block bg-gradient-to-r from-heat-1 via-brand to-heat-3 bg-clip-text pb-1 text-5xl text-transparent sm:text-6xl">
              Find the heat
            </span>
            <span className="mt-1 block text-3xl text-foreground sm:text-4xl">
              in every player prop
            </span>
          </h1>
          {/* The market-pricing claim only renders when book lines are actually on
              (PROVIDED_LINES_ENABLED) — the hero must never promise a feature the
              page below can't show. */}
          <p className="max-w-xl text-lg text-muted">
            {providedLinesEnabled() ? (
              <>
                {SITE.name} projects every player prop across eight pro and college leagues from
                public game logs — adjusted for matchup, pace, the Vegas game total, and usage —
                then prices it against the market to show where the number is soft. Built on the
                uncertainty most tools hide.
              </>
            ) : (
              <>
                {SITE.name} projects every player prop across eight pro and college leagues from
                public game logs — adjusted for matchup, pace, the Vegas game total, and usage —
                with hit rates, confidence intervals, and a fair-price calculator for the number
                on your card. Built on the uncertainty most tools hide.
              </>
            )}
          </p>
          {/* The one clear next step from the hero: the all-sports board. */}
          <Link
            href="/board"
            className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          >
            Open the Heat Check →
          </Link>
        </section>
      </div>

      {/* Teaser cards with the one page-wide (site-synced) book selector — everything
          else (filters, slate toggle) is each sport's Heat Check, one tap away. This
          section breaks out wider than the site's reading column so every sport card
          has room (each reaches ≥400px before wrapping; see HomeTopLeans). */}
      {cards.length > 0 ? (
        <div className="mx-auto w-full max-w-7xl px-2 sm:px-4">
          <HomeTopLeans cards={cards} />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
          <section className="mb-10 rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="mx-auto max-w-md text-sm text-muted">
              No games on the slate across our sports right now. You can still browse every
              player&rsquo;s game history and hit rates from the menu above.
            </p>
          </section>
        </div>
      )}

      {/* Dormant sports (off-season, or no slate today). Without this the summer
          home page is two cards and the "eight leagues" claim above has nothing to
          point at — historical leaders/players/matchups stay browsable year-round. */}
      {cards.length < SPORT_LIST.length && (
        <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
          <section className="mb-10 rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Between slates / off-season
              </span>
              {SPORT_LIST.filter((s) => !cards.some((c) => c.sport === s)).map((s) => (
                <Link
                  key={s}
                  href={`/${s}`}
                  className="rounded-full border border-line px-3 py-1 font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  {SPORTS[s].name}
                </Link>
              ))}
              <span className="text-xs text-muted">
                season stats, leaders &amp; player pages still open
              </span>
            </div>
          </section>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
        <section className="grid gap-4 pb-10 sm:grid-cols-3">
          <FeatureCard
            title="Matchup-aware projections"
            body="A model number for every prop — opponent, pace, the Vegas total, and recent usage folded in — turned into the probability the line clears."
          />
          <FeatureCard
            title="Edge vs. the market"
            body={
              providedLinesEnabled()
                ? 'We de-vig the books we track to a no-vig fair price, flag the best available number, and show the +EV — automatically, no odds to type.'
                : "Enter the book's odds on any player page to see the implied probability, the no-vig fair price, and the edge vs. that player's history."
            }
          />
          <FeatureCard
            title="Honest by construction"
            body="A 95% Wilson interval on every rate and a trust factor that discounts thin samples, so a hot streak never masquerades as an edge."
          />
        </section>
      </div>
    </>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
