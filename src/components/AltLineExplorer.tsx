import type { AltLineRow } from '@/lib/stats';
import { pct } from '@/lib/format';

/**
 * Alt-line explorer: the season over rate (with its 95% Wilson interval) at the
 * lines just above and below the one selected — so you can see where a soft-looking
 * number holds up or flips to a coin toss. Lines are user-entered, so this answers
 * "and if the book has it half a point higher?" without retyping. When `onSelect` is
 * provided (the player page), each line is clickable and funnels the full research
 * read — verdict, hit rates, chart, splits — through that exact number.
 */
export function AltLineExplorer({
  rows,
  statShort,
  windowLabel = 'season',
  onSelect,
}: {
  rows: AltLineRow[];
  statShort: string;
  windowLabel?: string;
  /** Recompute the whole read at this line (the same path as the line input). */
  onSelect?: (line: number) => void;
}) {
  // Nothing to compare against if the player has no decided games anywhere.
  if (rows.every((r) => r.decided === 0)) return null;

  return (
    <section aria-labelledby="alt-lines-heading" className="mb-6">
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="mb-3">
          <h3 id="alt-lines-heading" className="text-sm font-semibold">
            Alternate lines
          </h3>
          <p className="mt-1 text-xs text-muted">
            {statShort} over rate across nearby lines ({windowLabel}) — find where the
            edge holds or flips. The bar shows the 95% Wilson interval; the dot is the
            point estimate.
            {onSelect && <> Click a line to run the full read at that number.</>}
          </p>
        </div>

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Over hit rate and 95% Wilson confidence interval at each alternate {statShort}{' '}
            line, {windowLabel} window
          </caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="py-1 pr-3 text-left font-medium">
                Line
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium tabular-nums">
                Over
              </th>
              <th scope="col" className="hidden py-1 pr-3 text-right font-medium tabular-nums sm:table-cell">
                O / U
              </th>
              <th scope="col" className="py-1 text-left font-medium">
                <span className="sr-only">Confidence interval</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overPct = r.hitRateOver;
              const lowerW = Math.round(r.wilsonLower * 100);
              const bandW = Math.max(1, Math.round((r.wilsonUpper - r.wilsonLower) * 100));
              const centerW = overPct === null ? null : Math.round(overPct * 100);
              return (
                <tr
                  key={r.line}
                  className={
                    'border-t border-line ' +
                    (r.isCurrent ? 'bg-surface' : '')
                  }
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 text-left font-medium tabular-nums"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {onSelect && !r.isCurrent ? (
                        <button
                          type="button"
                          onClick={() => onSelect(r.line)}
                          className="cursor-pointer rounded text-brand underline-offset-2 transition-colors hover:text-brand-strong hover:underline"
                          aria-label={`Run the full read at ${r.line} ${statShort}`}
                        >
                          {r.line}
                        </button>
                      ) : (
                        r.line
                      )}
                      {r.isCurrent && (
                        <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
                          Current
                        </span>
                      )}
                    </span>
                  </th>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {pct(overPct)}
                  </td>
                  <td className="hidden py-2 pr-3 text-right tabular-nums text-muted sm:table-cell">
                    {r.decided === 0 ? '—' : `${r.overs}/${r.decided}`}
                  </td>
                  <td className="py-2">
                    {/* Wilson interval bar: track 0–100%, band = [lower, upper],
                        dot = point estimate. 50% reference tick for context. */}
                    <div
                      className="relative h-2.5 w-full min-w-24 overflow-hidden rounded-full bg-surface"
                      role="img"
                      aria-label={
                        overPct === null
                          ? 'No decided games at this line'
                          : `${pct(overPct)} over, 95% interval ${pct(r.wilsonLower)} to ${pct(r.wilsonUpper)}`
                      }
                    >
                      <div
                        className="absolute inset-y-0 w-px bg-line"
                        style={{ left: '50%' }}
                        aria-hidden="true"
                      />
                      {overPct !== null && (
                        <>
                          <div
                            className="absolute inset-y-0 rounded-full bg-over-soft"
                            style={{ left: `${lowerW}%`, width: `${bandW}%` }}
                          />
                          <div
                            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-over"
                            style={{ left: `${centerW}%` }}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
