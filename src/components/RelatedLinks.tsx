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
