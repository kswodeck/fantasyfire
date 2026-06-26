import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Accessible breadcrumb trail. The last item is the current page (not a link);
 * the parent links double as the "quick way back". Data-agnostic.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      {/* Single non-wrapping row that scrolls horizontally on narrow screens (deep
          trails like Home › Sport › Players › [long name] › [stat]) instead of forcing
          the whole page to scroll. Scrollbar hidden; nothing is truncated or lost. */}
      <ol className="flex items-center gap-1.5 overflow-x-auto text-sm text-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex shrink-0 items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="whitespace-nowrap text-foreground"
                  aria-current={last ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden className="shrink-0 text-muted/60">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
