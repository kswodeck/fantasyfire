'use client';

import { useFavorites } from '@/hooks/useFavorites';
import { isFavorited, toggleFavorite } from '@/lib/favorites';
import { track } from '@/lib/analytics';
import type { Sport } from '@/lib/sports';

/**
 * Star toggle to save a player to device-local favorites (no login). Renders the
 * same markup before and after hydration to avoid layout shift; the filled state
 * appears once the store is read.
 */
export function FavoriteToggle({
  sport,
  slug,
  name,
  team,
  className = '',
}: {
  sport: Sport;
  slug: string;
  name: string;
  team?: string | null;
  className?: string;
}) {
  const { favorites } = useFavorites();
  const fav = isFavorited(favorites, sport, slug);

  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? `Remove ${name} from your Playbook` : `Save ${name} to your Playbook`}
      title={fav ? 'Saved — click to remove' : 'Save player to My Playbook'}
      onClick={() => {
        const nowFav = toggleFavorite({ sport, slug, name, team });
        if (nowFav) track('favorite_added', { sport });
      }}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ' +
        (fav
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-line bg-surface text-muted hover:text-foreground') +
        ' ' +
        className
      }
    >
      <span aria-hidden="true">{fav ? '★' : '☆'}</span>
      <span>{fav ? 'Saved' : 'Save'}</span>
    </button>
  );
}
