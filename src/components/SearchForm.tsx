/**
 * No-JS search form (progressive enhancement baseline). Submits a GET to
 * /players?q=… so search works without client JS and is crawlable. Phase 4 adds
 * a live client-side variant on top.
 */
export function SearchForm({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/players" className="flex w-full gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search players (e.g. Jokic, Edwards)…"
        aria-label="Search players"
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
