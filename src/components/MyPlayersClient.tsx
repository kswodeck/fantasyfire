'use client';

import Link from 'next/link';
import { useFavorites } from '@/hooks/useFavorites';
import { removeFavorite, type FavoritePlayer } from '@/lib/favorites';
import { SPORTS, SPORT_LIST, type Sport } from '@/lib/sports';

export function MyPlayersClient() {
  const { favorites, hydrated } = useFavorites();

  if (!hydrated) {
    return <p className="mt-6 text-sm text-muted">Loading your saved players…</p>;
  }

  if (favorites.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
        <p>
          You haven&rsquo;t saved any players yet. Open any player and tap{' '}
          <span className="font-medium text-foreground">☆ Save</span> to pin them here for quick
          access.
        </p>
        <p className="mt-3 flex flex-wrap gap-3">
          {SPORT_LIST.map((s) => (
            <Link
              key={s}
              href={`/${s}/players`}
              className="font-medium text-brand hover:text-brand-strong"
            >
              Browse {SPORTS[s].name} players →
            </Link>
          ))}
        </p>
      </div>
    );
  }

  const bySport = SPORT_LIST.map((sport) => ({
    sport,
    players: favorites.filter((f) => f.sport === sport),
  })).filter((g) => g.players.length > 0);

  return (
    <div className="mt-6 space-y-6">
      {bySport.map(({ sport, players }) => (
        <section key={sport}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {SPORTS[sport].name}
          </h2>
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {players.map((p) => (
              <FavoriteRow key={`${p.sport}:${p.slug}`} fav={p} sport={sport} />
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-muted">
        Saved on this device only (browser storage) — they don&rsquo;t sync across devices and
        clear if you clear site data. No account, no tracking.
      </p>
    </div>
  );
}

function FavoriteRow({ fav, sport }: { fav: FavoritePlayer; sport: Sport }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
      <Link
        href={`/${sport}/${fav.slug}`}
        className="min-w-0 flex-1 font-medium hover:text-brand"
      >
        {fav.name}
        {fav.team ? <span className="ml-2 text-xs text-muted">{fav.team}</span> : null}
      </Link>
      <button
        type="button"
        onClick={() => removeFavorite(sport, fav.slug)}
        aria-label={`Remove ${fav.name}`}
        className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:text-under"
      >
        Remove
      </button>
    </li>
  );
}
