'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/** Format a UTC ISO datetime in the viewer's local timezone, e.g. "4:30PM PDT". */
function formatLocalTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  // Assemble manually to drop the space before AM/PM -> "4:30PM PDT".
  return `${part('hour')}:${part('minute')}${part('dayPeriod')} ${part('timeZoneName')}`.trim();
}

/**
 * A game's start time in the viewer's OWN timezone, e.g. "4:30PM PDT".
 *
 * The server has no access to the browser's timezone, so formatting during SSR
 * would hydrate-mismatch (server tz vs client tz). The `useSyncExternalStore`
 * gate returns false on the server and the first client render — so both render
 * nothing and match — then true once hydrated, when we compute the local time.
 * `iso` is a full UTC datetime; null/invalid (e.g. an off-season fallback with no
 * scheduled time) renders nothing.
 */
export function MatchupTime({ iso, className }: { iso: string | null; className?: string }) {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!hydrated || !iso) return null;
  const text = formatLocalTime(iso);
  if (!text) return null;
  return <span className={className}>{text}</span>;
}
