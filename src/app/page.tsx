import { FlameMark } from '@/components/FlameMark';
import { HomeTopLeans, type HomeCard } from '@/components/HomeTopLeans';
import { getBoard, getSourcedBoards, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { SPORT_LIST, SPORTS, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

export const revalidate = 1800; // 30 min — keep the leans close to the ~15-min lines ingest (prod is on Pro; board reads are optimized)

async function loadSport(
  sport: Sport,
): Promise<{ boardsBySource: Record<string, BoardRow[]>; medianLeans: BoardRow[] }> {
  // Prefer real book lines (one board per book, switched by the page-wide selector);
  // fall back to our computed median line only when no book lines are ingested.
  const sources = await getAvailableSources(sport).catch(() => [] as string[]);
  if (sources.length > 0) {
    const boardsBySource = await getSourcedBoards(sport, sources, { limit: 6 }).catch(
      () => ({}) as Record<string, BoardRow[]>,
    );
    return { boardsBySource, medianLeans: [] };
  }
  const medianLeans = await getBoard(sport, { limit: 6 }).catch(() => [] as BoardRow[]);
  return { boardsBySource: {}, medianLeans };
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
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="flex flex-col items-center gap-6 py-14 text-center">
        <FlameMark className="h-14 w-14 text-brand" />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Honest player-prop research
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Hit rates, matchup context, sample-size confidence, and fair-price math across the NBA,
          MLB, and NFL — computed from public game logs, with the uncertainty shown rather than
          hidden.
        </p>
      </section>

      {/* One page-wide book selector drives every sport's Top Leans. */}
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
          title="Hit rates that don't lie"
          body="Over/under rates across recent windows and the full season — with the raw game-by-game bars, not just a number."
        />
        <FeatureCard
          title="Sample-size honesty"
          body="A Wilson confidence interval on every hit rate, so a short hot streak doesn't masquerade as a real edge."
        />
        <FeatureCard
          title="Matchup context"
          body="How the most-recent opponent stacks up — defense-vs-position in the NBA and NFL, opposing pitching in MLB."
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
