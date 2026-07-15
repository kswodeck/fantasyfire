import Link from 'next/link';

export interface RelatedLink {
  label: string;
  href: string;
  hint?: string;
}

/**
 * The internal-link mesh: a tile grid of related pages, rendered as real server
 * <a> hrefs so nothing is orphaned for crawlers (and humans). Presentational.
 */
export function RelatedLinks({
  title = 'Keep exploring',
  links,
}: {
  title?: string;
  links: RelatedLink[];
}) {
  if (links.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            prefetch={false}
            href={l.href}
            className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{l.label}</span>
              <span className="text-muted transition-transform group-hover:translate-x-0.5">→</span>
            </div>
            {l.hint && <p className="mt-1 text-xs leading-relaxed text-muted">{l.hint}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * A compact inline row of related links (e.g. a player's other props). Same
 * crawlable <a> mesh as RelatedLinks, but as small text links — used where big
 * tiles would just duplicate an on-page control (like the stat selector).
 */
export function MoreLinksRow({ label, links }: { label: string; links: RelatedLink[] }) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={label} className="mt-8 text-sm">
      <span className="text-muted">{label}: </span>
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 && <span className="text-muted"> · </span>}
          <Link
            prefetch={false}
            href={l.href}
            className="font-medium text-brand transition-colors hover:text-brand-strong hover:underline"
          >
            {l.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
