'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Sport } from '@/lib/sports';
import { sectionHref, sportSections } from '@/lib/sportNav';

// Per-sport secondary nav — same section list the header sport buttons show as a
// hover menu. Scrollable on mobile; highlights the current section.
export function SportNav({ sport }: { sport: Sport }) {
  const pathname = usePathname();
  return (
    <nav aria-label={`${sport.toUpperCase()} sections`} className="-mx-4 overflow-x-auto px-4">
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
