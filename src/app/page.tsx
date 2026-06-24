import { FlameMark } from '@/components/FlameMark';
import { SearchForm } from '@/components/SearchForm';
import { PlayerCard } from '@/components/PlayerCard';
import { searchPlayers } from '@/lib/server/players';
import type { PlayerListItem } from '@/lib/types';

export const revalidate = 3600;

export default async function Home() {
  let trending: PlayerListItem[] = [];
  try {
    trending = await searchPlayers(undefined, 12);
  } catch {
    // DB unavailable — render the hero without the trending grid.
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section className="flex flex-col items-center gap-6 py-16 text-center">
        <FlameMark className="h-14 w-14 text-brand" />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Honest NBA player-prop research
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Hit rates, defense-vs-position matchups, sample-size confidence, and fair-price
          math — computed from public game logs, with the uncertainty shown rather than
          hidden.
        </p>
        <div className="w-full max-w-xl">
          <SearchForm />
        </div>
      </section>

      {trending.length > 0 && (
        <section className="pb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Most active players
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((p) => (
              <PlayerCard key={p.slug} player={p} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 pb-8 sm:grid-cols-3">
        <FeatureCard
          title="Hit rates that don't lie"
          body="Over/under rates across L5, L10, L20 and the full season — with the raw game-by-game bars, not just a number."
        />
        <FeatureCard
          title="Sample-size honesty"
          body="A Wilson confidence interval on every hit rate, so a 4/5 streak doesn't masquerade as a real edge."
        />
        <FeatureCard
          title="Matchup context"
          body="Defense-vs-position: how many points, rebounds or assists each opponent gives up to a player's role."
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
