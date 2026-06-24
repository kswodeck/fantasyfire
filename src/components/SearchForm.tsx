import type { Sport } from '@/lib/sports';
import { SPORTS } from '@/lib/sports';

/**
 * No-JS search form (progressive enhancement baseline). Submits a GET to
 * /{sport}/players?q=… so search works without client JS and is crawlable.
 */
export function SearchForm({
  sport,
  defaultValue = '',
}: {
  sport: Sport;
  defaultValue?: string;
}) {
  const noun = SPORTS[sport].name;
  return (
    <form action={`/${sport}/players`} className="flex w-full gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={`Search ${noun} players…`}
        aria-label={`Search ${noun} players`}
        className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
      />
      <button
        type="submit"
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
      >
        Search
      </button>
    </form>
  );
}
