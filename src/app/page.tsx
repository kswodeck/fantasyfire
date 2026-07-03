import { FlameMark } from '@/components/FlameMark';
import { HomeTopLeans, type HomeCard } from '@/components/HomeTopLeans';
import { getBoard, getSourcedBoards, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { SITE } from '@/lib/site';
import { SPORT_LIST, SPORTS, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

export const revalidate = 900; // 15 min — matches the lines ingest cadence, bounding board↔player-page score skew to one cycle

async function loadSport(sport: Sport): Promise<{ leans: BoardRow[] }> {
  // A taste of the default book's top reads (our median line only when no book lines
  // are ingested). Home is deliberately controls-free — the book selector, slate
  // toggle, and filters all live on the sport's Heat Check — so one small board per
  // sport is all the teaser needs.
  const sources = await getAvailableSources(sport).catch(() => [] as string[]);
  if (sources.length > 0) {
    const source = sources.includes(DEFAULT_PROVIDED_SOURCE) ? DEFAULT_PROVIDED_SOURCE : sources[0];
    const boards = await getSourcedBoards(sport, [source], { limit: 3, standardOnly: true }).catch(
      () => ({}) as Record<string, BoardRow[]>,
    );
    return { leans: boards[source] ?? [] };
  }
  return { leans: await getBoard(sport, { limit: 3 }).catch(() => [] as BoardRow[]) };
}

export default async function Home() {
  // Only surface sports with an upcoming slate — off-season "leans" are computed
  // from past games and aren't actionable props, so those sports are hidden here.
  // DB unavailable → no sports (the no-slate empty state), never a 500.
  const activeSports = (
    await Promise.all(
      SPORT_LIST.map(async (s) => ((await hasUpcomingGames(s).catch(() => false)) ? s : null)),
    )
  ).filter((s): s is Sport => s !== null);

  const loaded = await Promise.all(activeSports.map(async (s) => [s, await loadSport(s)] as const));
  const cards: HomeCard[] = loaded.map(([sport, d]) => {
    const cfg = SPORTS[sport];
    return {
      sport,
      name: cfg.name,
      accent: cfg.accent,
      tagline: cfg.tagline,
      leans: d.leans,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
      <section className="flex flex-col items-center gap-6 py-14 text-center">
        <FlameMark className="h-14 w-14 text-brand" />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Find the heat in every player prop
        </h1>
        <p className="max-w-xl text-lg text-muted">
          {SITE.name} projects every NBA, MLB, and NFL player prop from public game logs —
          adjusted for matchup, pace, the Vegas game total, and usage — then prices it against the
          market to show where the number is soft. Built on the uncertainty most tools hide.
        </p>
      </section>

      {/* Controls-free teaser cards — the full Heat Check (books, filters, slate) is
          each sport's home page, one tap away. */}
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
