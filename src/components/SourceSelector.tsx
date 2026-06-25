'use client';

import { sourceLabel } from '@/lib/providedSources';

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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium text-foreground transition-colors hover:border-brand focus:border-brand focus:outline-none"
      >
        {sources.map((s) => (
          <option key={s} value={s}>
            {sourceLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}
