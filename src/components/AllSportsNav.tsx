'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Cross-sport secondary nav — the all-sports counterpart to SportNav. Links the
// three merged, all-league surfaces (Heat Check / Trends / Accuracy) to each
// other with the same pill-tab styling the single-sport section nav uses, so the
// two navs read as one system. Scrollable on mobile (future-proof if the list
// grows); highlights the current surface by exact path.
const ALL_SPORTS_SECTIONS: { label: string; href: string }[] = [
  { label: 'Heat Check', href: '/board' },
  { label: 'Trends', href: '/trends' },
  { label: 'Accuracy', href: '/accuracy' },
];

export function AllSportsNav() {
  const pathname = usePathname();
  // Bleed mirrors the parent's px-2 / sm:px-4 (same reasoning as SportNav) so the
  // tab row can't add a horizontal scrollbar on phones.
  return (
    <nav
      aria-label="All Sports sections"
      className="-mx-2 mb-4 overflow-x-auto px-2 sm:-mx-4 sm:px-4"
    >
      <ul className="flex gap-1 whitespace-nowrap text-sm">
        {ALL_SPORTS_SECTIONS.map((it) => {
          const active = pathname === it.href;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
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
