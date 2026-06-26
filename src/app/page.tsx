import Link from 'next/link';
import { FlameMark } from '@/components/FlameMark';
import { BoardTable } from '@/components/BoardTable';
import { SourcedBoardTable } from '@/components/SourcedBoardTable';
import { getBoard, getSourcedBoards, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { SPORT_LIST, SPORTS, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

export const revalidate = 1800; // 30 min — keep the leans close to the ~15-min lines ingest (prod is on Pro; board reads are optimized)

async function loadSport(sport: Sport) {
  // Prefer real book lines (PrizePicks / Underdog / …) with a per-book dropdown; fall
  // back to our computed median line only when no book lines are ingested.
  const sources = await getAvailableSources(sport).catch(() => [] as string[]);
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);
  if (sources.length > 0) {
    const boardsBySource = await getSourcedBoards(sport, sources, { limit: 6 }).catch(
      () => ({}) as Record<string, BoardRow[]>,
    );
    return { sources, initialSource, boardsBySource, leans: boardsBySource[initialSource] ?? [] };
  }
  const leans = await getBoard(sport, { limit: 6 }).catch(() => [] as BoardRow[]);
  return { sources, initialSource, boardsBySource: {} as Record<string, BoardRow[]>, leans };
}

export default async function Home() {
  // Only surface sports with an upcoming slate — off-season "leans" are computed
  // from past games and aren't actionable props, so those sports are hidden here.
  const activeSports = (
    await Promise.all(SPORT_LIST.map(async (s) => ((await hasUpcomingGames(s)) ? s : null)))
  ).filter((s): s is Sport => s !== null);

  const data = Object.fromEntries(
    await Promise.all(activeSports.map(async (s) => [s, await loadSport(s)] as const)),
  ) as Record<Sport, Awaited<ReturnType<typeof loadSport>>>;

  // Lay the panels out by how many sports are in season (1 = centered, 2/3 = grid).
  const gridCols =
    activeSports.length >= 3
      ? 'sm:grid-cols-2 lg:grid-cols-3'
      : activeSports.length === 2
        ? 'sm:grid-cols-2'
        : 'mx-auto max-w-md';

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="flex flex-col items-center gap-6 py-14 text-center">
        <FlameMark className="h-14 w-14 text-brand" />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Honest player-prop research
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Hit rates, matchup context, sample-size confidence, and fair-price math across
          the NBA, MLB, and NFL — computed from public game logs, with the uncertainty
          shown rather than hidden.
        </p>
      </section>

      {/* Per-sport dashboard panels — only sports with an upcoming slate. */}
      {activeSports.length > 0 ? (
        <section className={`grid gap-5 pb-10 ${gridCols}`}>
          {activeSports.map((sport) => {
            const cfg = SPORTS[sport];
            const { leans, sources, initialSource, boardsBySource } = data[sport];
            const hasSources = sources.length > 0;
            return (
              <div
                key={sport}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
                style={{ borderTop: `3px solid ${cfg.accent}` }}
              >
                <div className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{cfg.name}</h2>
                    <p className="mt-1 max-w-xs text-sm text-muted">{cfg.tagline}</p>
                  </div>
                  <Link
                    href={`/${sport}`}
                    className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: cfg.accent }}
                  >
                    Open {cfg.name} →
                  </Link>
                </div>

                <div className="space-y-2 border-t border-line p-4">
                  {hasSources ? (
                    <SourcedBoardTable
                      sport={sport}
                      boardsBySource={boardsBySource}
                      sources={sources}
                      defaultSource={initialSource}
                      heading={
                        <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                          Top leans
                        </h3>
                      }
                      emptyText="No props on this book right now."
                    />
                  ) : (
                    <>
                      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        Top leans
                      </h3>
                      {leans.length === 0 ? (
                        <p className="px-1 py-4 text-sm text-muted">No data available yet.</p>
                      ) : (
                        <BoardTable sport={sport} rows={leans} />
                      )}
                    </>
                  )}
                  <Link
                    href={`/${sport}/board`}
                    className="mt-1 block rounded-lg px-1 py-2 text-sm font-medium text-brand transition-colors hover:text-brand-strong"
                  >
                    See the full {cfg.name} board →
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
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
