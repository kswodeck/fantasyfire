'use client';

import { sourceLabel } from '@/lib/providedSources';
import { BookLogo } from './BookLogo';

/**
 * Dropdown to pick which book's line/odds to show (PrizePicks, Underdog, …). The whole
 * control — logo + name + chevron — is one bordered, pointer-cursor target: the native
 * <select> is stretched transparently across it (absolute inset-0, opacity-0), so a
 * click anywhere (the logo included) opens it. The hover / focus / active highlight
 * lives on the WRAPPER (focus-within), while the <select>'s own outline is suppressed
 * (opacity-0 + focus:outline-none) so no effect ever shows on the select alone. Options
 * get explicit surface/foreground colors so the list reads in both themes. Renders
 * nothing when there are no sources.
 */
export function SourceSelector({
  sources,
  value,
  onChange,
  label = 'Lines from',
  id = 'source-selector',
}: {
  sources: string[];
  value: string;
  onChange: (next: string) => void;
  label?: string;
  id?: string;
}) {
  if (sources.length === 0) return null;
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="font-semibold uppercase tracking-wide" style={{ display: 'none' }}>
        {label}
      </span>
      <span className="relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface py-2 pl-2.5 pr-8 transition-colors hover:border-brand/60 focus-within:border-brand active:bg-surface-2">
        <BookLogo source={value} size={22} />
        <span className="text-base font-medium text-foreground">{sourceLabel(value)}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted"
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Transparent, full-cover click target — opens on a click anywhere in the pill,
            and shows no effect of its own (the highlight is on the wrapper above). The 16px
            font keeps the native option list legible + stops iOS zoom-on-focus. */}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none text-base opacity-0 focus:outline-none"
        >
          {sources.map((s) => (
            <option key={s} value={s} className="cursor-pointer bg-surface text-base text-foreground">
              {sourceLabel(s)}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
