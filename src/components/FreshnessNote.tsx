import { formatIsoDate } from '@/lib/format';

/** The honest "nightly, not live" freshness stamp, shared across data pages. */
export function FreshnessNote({ date, className = '' }: { date: string | null; className?: string }) {
  if (!date) return null;
  return (
    <p className={`text-xs text-muted ${className}`}>
      Stats updated: {formatIsoDate(date)} — nightly box scores, not live.
    </p>
  );
}
