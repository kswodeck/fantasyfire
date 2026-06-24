import Link from 'next/link';
import { FlameMark } from '@/components/FlameMark';
import { BoardTable } from '@/components/BoardTable';
import { getBoard, getSportSummary } from '@/lib/server/players';
import { SPORT_LIST, SPORTS, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

export const revalidate = 3600;

async function loadSport(sport: Sport) {
  try {
    const [summary, leans] = await Promise.all([
      getSportSummary(sport),
      getBoard(sport, { limit: 6 }),
    ]);
    return { summary, leans };
  } catch {
    return { summary: null, leans: [] as BoardRow[] };
  }
}

export default async function Home() {
  const data = Object.fromEntries(
    await Promise.all(SPORT_LIST.map(async (s) => [s, await loadSport(s)] as const)),
  ) as Record<Sport, Awaited<ReturnType<typeof loadSport>>>;

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="flex flex-col items-center gap-6 py-14 text-center">
        <FlameMark className="h-14 w-14 text-brand" />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Honest player-prop research
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Hit rates, matchup context, sample-size confidence, and fair-price math across
          the NBA and MLB — computed from public game logs, with the uncertainty shown
          rather than hidden.
        </p>
      </section>

      {/* Per-sport dashboard panels */}
      <section className="grid gap-5 pb-10 md:grid-cols-2">
        {SPORT_LIST.map((sport) => {
          const cfg = SPORTS[sport];
          const { summary, leans } = data[sport];
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
                  className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
                  style={{ backgroundColor: cfg.accent }}
                >
                  Open {cfg.name} →
                </Link>
              </div>

              {summary && (
                <div className="flex gap-6 border-y border-line bg-surface-2 px-5 py-3 text-sm">
                  <span>
                    <span className="font-semibold tabular-nums">{summary.players}</span>{' '}
                    <span className="text-muted">players</span>
                  </span>
                  <span>
                    <span className="font-semibold tabular-nums">{summary.games}</span>{' '}
                    <span className="text-muted">games</span>
                  </span>
                  <span className="text-muted">Season {summary.season}</span>
                </div>
              )}

              <div className="space-y-2 p-4">
                <h3 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Top leans
                  <span className="rounded bg-surface px-1 py-0.5 text-[9px] font-medium normal-case text-muted">
                    experimental
                  </span>
                </h3>
                {leans.length === 0 ? (
                  <p className="px-1 py-4 text-sm text-muted">No data available yet.</p>
                ) : (
                  <BoardTable sport={sport} rows={leans} />
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
          body="How the most-recent opponent stacks up — defense-vs-position in the NBA, opposing pitching in MLB."
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
