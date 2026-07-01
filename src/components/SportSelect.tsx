'use client';

import { useRouter } from 'next/navigation';
import { SPORTS, SPORT_LIST, type Sport } from '@/lib/sports';

/** Where a given (sport | 'all', section) lands. "All Sports" uses the top-level
 *  cross-sport route (/board, /trends); a sport uses its scoped route. */
function hrefFor(value: Sport | 'all', section: string): string {
  return value === 'all' ? `/${section}` : `/${value}/${section}`;
}

/**
 * Sport switcher for the list pages — a native <select> that navigates to the same
 * section under the chosen sport (and to the cross-sport route for "All Sports", on
 * the pages that support it). Navigation, not client filtering, so each sport keeps
 * its own static/ISR page and canonical URL.
 */
export function SportSelect({
  section,
  value,
  includeAll = false,
}: {
  /** Route segment this control lives on, e.g. "board" | "leaders". */
  section: string;
  /** Currently-active sport, or 'all' on a cross-sport page. */
  value: Sport | 'all';
  /** Offer an "All Sports" option (Heat Check / Trends only). */
  includeAll?: boolean;
}) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
      <span>Sport</span>
      <select
        aria-label="Switch sport"
        value={value}
        onChange={(e) => router.push(hrefFor(e.target.value as Sport | 'all', section))}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
      >
        {includeAll && <option value="all">All Sports</option>}
        {SPORT_LIST.map((s) => (
          <option key={s} value={s}>
            {SPORTS[s].name}
          </option>
        ))}
      </select>
    </label>
  );
}
