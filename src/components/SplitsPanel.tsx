import type { PlayerSplits, SplitResult } from '@/lib/stats';
import { pct } from '@/lib/format';

const BADGE_TEXT: Record<string, string> = {
  High: 'text-conf-high',
  Medium: 'text-conf-med',
  Low: 'text-muted',
};

function SplitRow({ s }: { s: SplitResult }) {
  const over = s.hitRate.hitRateOver;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
      <span className="text-muted">{s.label}</span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums">{over === null ? '—' : pct(over)}</span>
        <span className="text-[11px] tabular-nums text-muted">
          {s.hitRate.overs}/{s.hitRate.decided}
        </span>
        <span className={`w-12 text-right text-[11px] ${BADGE_TEXT[s.confidence.badge] ?? 'text-muted'}`}>
          {s.confidence.badge}
        </span>
      </span>
    </div>
  );
}

/**
 * Situational splits (presentational): the over rate for a stat + line broken
 * down by home/away and by days since the last game, each with its own Wilson
 * confidence so thin splits read Low rather than as an edge.
 */
export function SplitsPanel({
  splits,
  statShort,
  line,
}: {
  splits: PlayerSplits;
  statShort: string;
  line: number;
}) {
  if (splits.homeAway.length === 0 && splits.rest.length === 0) return null;
  return (
    <section
      aria-label="Situational splits"
      className="mb-6 rounded-xl border border-line bg-surface-2 p-4"
    >
      <h3 className="text-sm font-semibold">Situational splits</h3>
      <p className="mt-1 text-xs text-muted">
        Over {line} {statShort}{' '}by situation, each with its own confidence — thin splits read Low,
        so a small-sample &ldquo;crushes at home&rdquo; doesn&rsquo;t masquerade as an edge.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {splits.homeAway.length > 0 && (
          <div>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Home / Away
            </div>
            <div className="mt-1 divide-y divide-line rounded-lg border border-line bg-surface">
              {splits.homeAway.map((s) => (
                <SplitRow key={s.key} s={s} />
              ))}
            </div>
          </div>
        )}
        {splits.rest.length > 0 && (
          <div>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Days since last game
            </div>
            <div className="mt-1 divide-y divide-line rounded-lg border border-line bg-surface">
              {splits.rest.map((s) => (
                <SplitRow key={s.key} s={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
