'use client';

import { sourceLabel } from '@/lib/providedSources';
import { BookLogo } from './BookLogo';

/**
 * Dropdown to pick which book's line/odds to show (PrizePicks, Underdog, …).
 * Renders nothing when there are no sources (feature off / none ingested).
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
      <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface pl-1.5 transition-colors focus-within:border-brand hover:border-brand">
        <BookLogo source={value} />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border-0 bg-transparent py-1 pr-2 text-sm font-medium text-foreground focus:outline-none"
        >
          {sources.map((s) => (
            <option key={s} value={s}>
              {sourceLabel(s)}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
