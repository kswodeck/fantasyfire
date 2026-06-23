import type { Confidence } from '@/lib/stats';
import { pct } from '@/lib/format';

const BADGE_STYLES: Record<Confidence['badge'], string> = {
  High: 'bg-over-soft text-over',
  Medium: 'text-conf-med',
  Low: 'text-conf-low',
};

const MEDIUM_BG = 'bg-amber-100 dark:bg-amber-950/40';
const LOW_BG = 'bg-under-soft';

/**
 * Wilson-confidence pill. Shows the badge and (optionally) the 95% interval so
 * uncertainty is visible, not hidden behind a single percentage (PLAN §5c).
 */
export function ConfidenceBadge({
  confidence,
  showInterval = true,
}: {
  confidence: Confidence;
  showInterval?: boolean;
}) {
  const { badge, interval } = confidence;
  const bg =
    badge === 'Medium' ? MEDIUM_BG : badge === 'Low' ? LOW_BG : '';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`rounded-full px-2 py-0.5 font-medium ${BADGE_STYLES[badge]} ${bg}`}
        title="Confidence from a 95% Wilson score interval on the hit rate"
      >
        {badge} confidence
      </span>
      {showInterval && interval.n > 0 && (
        <span className="tabular-nums text-muted">
          95% CI {pct(interval.lower)}–{pct(interval.upper)}
        </span>
      )}
    </span>
  );
}
