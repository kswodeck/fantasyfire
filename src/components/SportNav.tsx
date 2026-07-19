'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Sport } from '@/lib/sports';
import { sectionHref, sportSections } from '@/lib/sportNav';

// Per-sport secondary nav — same section list the header sport buttons show as a
// hover menu. Scrollable on mobile; highlights the current section.
export function SportNav({ sport }: { sport: Sport }) {
  const pathname = usePathname();
  // The bleed must mirror the parent's padding (px-2 / sm:px-4 in the sport
  // layout) — a -mx-4 bleed inside a px-2 parent overhangs 8px and gives the
  // whole page a horizontal scrollbar on phones.
  return (
    <nav
      aria-label={`${sport.toUpperCase()} sections`}
      className="-mx-2 overflow-x-auto px-2 sm:-mx-4 sm:px-4"
    >
      <ul className="flex gap-1 whitespace-nowrap text-sm">
        {sportSections(sport).map((it) => {
          const href = sectionHref(sport, it.seg);
          // Heat Check IS the sport home — prefix-matching '/' would light it up on
          // every subpage, so it only matches exactly.
          const active =
            pathname === href || (it.seg !== '' && pathname.startsWith(`${href}/`));
          return (
            <li key={it.seg}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-block rounded-full px-3 py-1.5 font-medium transition-colors ${
                  active ? 'bg-surface-2 text-foreground' : 'text-muted hover:text-foreground'
                }`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
