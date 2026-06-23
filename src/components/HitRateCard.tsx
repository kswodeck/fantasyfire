import type { WindowResult } from '@/lib/types';
import { pct } from '@/lib/format';
import { ConfidenceBadge } from './ConfidenceBadge';

const WINDOW_LABEL: Record<string, string> = {
  '5': 'Last 5',
  '10': 'Last 10',
  '20': 'Last 20',
  season: 'Season',
};

/**
 * One hit-rate card for a window (L5/L10/L20/season): the over/under split, the
 * percentage, a visual bar, and the Wilson confidence badge + interval.
 */
export function HitRateCard({ result }: { result: WindowResult }) {
  const { hitRate, confidence } = result;
  const over = hitRate.hitRateOver;
  const hasData = hitRate.decided > 0;
  const overPctWidth = over === null ? 0 : Math.round(over * 100);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-muted">
          {WINDOW_LABEL[result.window] ?? result.window}
        </span>
        <span className="text-xs text-muted">
          {hitRate.games} {hitRate.games === 1 ? 'game' : 'games'}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{pct(over)}</span>
        <span className="text-sm text-muted">over</span>
      </div>

      <div className="text-sm tabular-nums text-muted">
        <span className="font-medium text-over">{hitRate.overs}</span> over
        {' · '}
        <span className="font-medium text-under">{hitRate.unders}</span> under
        {hitRate.pushes > 0 && (
          <>
            {' · '}
            <span className="font-medium text-push">{hitRate.pushes}</span> push
          </>
        )}
      </div>

      {/* Over/under split bar */}
      <div
        className="flex h-2 overflow-hidden rounded-full bg-under-soft"
        aria-hidden="true"
      >
        <div className="h-full bg-over" style={{ width: `${overPctWidth}%` }} />
      </div>

      {hasData ? (
        <ConfidenceBadge confidence={confidence} />
      ) : (
        <span className="text-xs text-muted">No decided games at this line</span>
      )}
    </div>
  );
}
