import type { LineValueComparison } from '@/lib/types';
import { sourceLabel } from '@/lib/providedSources';
import { pct } from '@/lib/format';
import { BookLogo } from './BookLogo';

/**
 * Cross-book line shopping for one player + stat: each book's number and the player's
 * season hit rate on the leaning side at that number, scored against the market
 * consensus (median). A softer number you clear more often is a discount (positive
 * edge), and the best one is highlighted — it's the same edge that lifts FireFactor.
 */
export function LineValueTable({
  data,
  statShort,
}: {
  data: LineValueComparison;
  statShort: string;
}) {
  const sideWord = data.side === 'over' ? 'over' : 'under';
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold">Line shopping — {statShort}</h2>
      <p className="mb-3 mt-1 max-w-2xl text-sm text-muted">
        Each book&rsquo;s line and your season {sideWord} rate at that number, vs the market
        consensus ({data.consensusLine} {statShort}). A softer number you&rsquo;d clear more often is
        a discount — the best one lifts the FireFactor read.
      </p>
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        <li className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <span className="flex-1">Book</span>
          <span className="w-10 text-right">Line</span>
          <span className="w-14 text-right">{sideWord} rate</span>
          <span className="w-16 text-right">Edge</span>
        </li>
        {data.books.map((b) => {
          const isBest = data.best?.source === b.source;
          const edgeCls =
            b.edge > 0.005 ? 'text-over' : b.edge < -0.005 ? 'text-under' : 'text-muted';
          return (
            <li
              key={b.source}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm ${isBest ? 'bg-over-soft' : ''}`}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <BookLogo source={b.source} />
                <span className="truncate font-medium">{sourceLabel(b.source)}</span>
                {isBest && (
                  <span className="shrink-0 rounded-full bg-over/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-over">
                    best
                  </span>
                )}
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums">{b.line}</span>
              <span className="w-14 shrink-0 text-right tabular-nums text-muted">
                {pct(b.sideHitRate)}
              </span>
              <span className={`w-16 shrink-0 text-right font-semibold tabular-nums ${edgeCls}`}>
                {b.edge > 0 ? '+' : ''}
                {Math.round(b.edge * 100)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        {sideWord} rate = season hit rate at that line. Edge = points of hit rate vs the consensus
        line. Descriptive research from past games — not betting advice.
      </p>
    </section>
  );
}
