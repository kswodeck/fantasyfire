import { FlameMark } from '@/components/FlameMark';
import { HomeTopLeans, type HomeCard } from '@/components/HomeTopLeans';
import { getBoard, getSourcedBoards, getTonightSlate, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { SITE } from '@/lib/site';
import { SPORT_LIST, SPORTS, type Sport } from '@/lib/sports';
import type { BoardRow, TonightGame } from '@/lib/types';

export const revalidate = 1800; // 30 min — keep the leans close to the ~15-min lines ingest (prod is on Pro; board reads are optimized)

function slateTeams(games: TonightGame[]): string[] {
  return [
    ...new Set(games.flatMap((g) => [g.home.abbr, g.away.abbr]).filter((a): a is string => !!a)),
  ];
}

async function loadSport(sport: Sport): Promise<{
  boardsBySource: Record<string, BoardRow[]>;
  medianLeans: BoardRow[];
  todayTeams: string[];
}> {
  // Prefer real book lines (one board per book, switched by the page-wide selector);
  // fall back to our computed median line only when no book lines are ingested. We
  // pull a bit more than the 6 we show so the page-wide "today's slate" filter still
  // yields a full teaser — `limit` only caps the rows returned, not the DB reads.
  const sources = await getAvailableSources(sport).catch(() => [] as string[]);
  const slate = getTonightSlate(sport).catch(() => ({ date: null, games: [] as TonightGame[] }));
  if (sources.length > 0) {
    const [s, boardsBySource] = await Promise.all([
      slate,
      getSourcedBoards(sport, sources, { limit: 24, standardOnly: true }).catch(
        () => ({}) as Record<string, BoardRow[]>,
      ),
    ]);
    return { boardsBySource, medianLeans: [], todayTeams: slateTeams(s.games) };
  }
  const [s, medianLeans] = await Promise.all([
    slate,
    getBoard(sport, { limit: 24 }).catch(() => [] as BoardRow[]),
  ]);
  return { boardsBySource: {}, medianLeans, todayTeams: slateTeams(s.games) };
}

export default async function Home() {
  // Only surface sports with an upcoming slate — off-season "leans" are computed
  // from past games and aren't actionable props, so those sports are hidden here.
  const activeSports = (
    await Promise.all(SPORT_LIST.map(async (s) => ((await hasUpcomingGames(s)) ? s : null)))
  ).filter((s): s is Sport => s !== null);

  const loaded = await Promise.all(activeSports.map(async (s) => [s, await loadSport(s)] as const));
  const cards: HomeCard[] = loaded.map(([sport, d]) => {
    const cfg = SPORTS[sport];
    return {
      sport,
      name: cfg.name,
      accent: cfg.accent,
      tagline: cfg.tagline,
      boardsBySource: d.boardsBySource,
      medianLeans: d.medianLeans,
      todayTeams: d.todayTeams,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="flex flex-col items-center gap-6 py-14 text-center">
        <FlameMark className="h-14 w-14 text-brand" />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          A projection and a fair price for every prop
        </h1>
        <p className="max-w-xl text-lg text-muted">
          {SITE.name} projects every NBA, MLB, and NFL player prop from public game logs —
          adjusted for matchup, pace, the Vegas game total, and usage — then prices it against the
          market to show where the number is soft. Built on the uncertainty most tools hide.
        </p>
      </section>

      {/* One page-wide book selector + today's-slate toggle drive every sport's Heat Check. */}
      {cards.length > 0 ? (
        <HomeTopLeans cards={cards} />
      ) : (
        <section className="mb-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="mx-auto max-w-md text-sm text-muted">
            No games on the slate across our sports right now. You can still browse every
            player&rsquo;s game history and hit rates from the menu above.
          </p>
        </section>
      )}

      <section className="grid gap-4 pb-10 sm:grid-cols-3">
        <FeatureCard
          title="Matchup-aware projections"
          body="A model number for every prop — opponent, pace, the Vegas total, and recent usage folded in — turned into the probability the line clears."
        />
        <FeatureCard
          title="Edge vs. the market"
          body="We de-vig the books we track to a no-vig fair price, flag the best available number, and show the +EV — automatically, no odds to type."
        />
        <FeatureCard
          title="Honest by construction"
          body="A 95% Wilson interval on every rate and a trust factor that discounts thin samples, so a hot streak never masquerades as an edge."
        />
      </section>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
