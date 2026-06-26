'use client';

import { sourceLabel } from '@/lib/providedSources';
import { BookLogo } from './BookLogo';

/**
 * Dropdown to pick which book's line/odds to show (PrizePicks, Underdog, …). The whole
 * control — logo + name + chevron — is one bordered element that highlights on hover /
 * focus (not just the text). The native select chrome is removed (custom chevron, no
 * focus outline) and the option list gets explicit surface/foreground colors so it's
 * readable in both light and dark themes. Renders nothing when there are no sources.
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
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      <span className="relative inline-flex items-center gap-1.5 rounded-md border border-line bg-surface py-1 pl-1.5 pr-6 transition-colors hover:border-brand focus-within:border-brand">
        <BookLogo source={value} />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="cursor-pointer appearance-none border-0 bg-transparent text-sm font-medium text-foreground focus:outline-none"
        >
          {sources.map((s) => (
            <option key={s} value={s} className="bg-surface text-foreground">
              {sourceLabel(s)}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="pointer-events-none absolute right-1.5 h-3 w-3 text-muted"
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
      </span>
    </label>
  );
}
