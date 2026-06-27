import type { MarketConsensus } from '@/lib/odds';
import { pct, americanOdds } from '@/lib/format';
import { sourceLabel } from '@/lib/providedSources';

function signedPct(x: number): string {
  const v = (x * 100).toFixed(1);
  return x >= 0 ? `+${v}%` : `${v}%`;
}

/**
 * Automated market edge (idea #1): the no-vig consensus across the books we track,
 * the best available price for each side, and the +EV of that price vs the consensus
 * — plus, when we have a model probability, our model's disagreement with the market.
 * Honestly labelled: a comparison of numbers, not a guarantee.
 */
export function MarketEdgePanel({
  consensus,
  statShort,
  modelProbOver,
}: {
  consensus: MarketConsensus;
  statShort: string;
  /** Model P(over) from the projection's distribution, to show model-vs-market edge. */
  modelProbOver: number | null;
}) {
  // No two-sided book ⇒ no fair price to compare against; nothing to show.
  if (consensus.fairProbOver == null) return null;

  const modelEdgeOver =
    modelProbOver == null ? null : modelProbOver - consensus.fairProbOver;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Market edge
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            auto
          </span>
        </h3>
        <span className="text-xs text-muted">
          {consensus.bookCount} book{consensus.bookCount === 1 ? '' : 's'} @ {consensus.line}{' '}
          {statShort}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="No-vig fair (over)" value={pct(consensus.fairProbOver, 1)} />
        <Row label="No-vig fair (under)" value={pct(consensus.fairProbUnder, 1)} />
      </dl>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <BestPriceCard side="Over" best={consensus.bestOver} />
        <BestPriceCard side="Under" best={consensus.bestUnder} />
      </div>

      {modelEdgeOver !== null && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Model vs market (over)</span>
            <span
              className={
                'text-lg font-bold tabular-nums ' +
                (modelEdgeOver > 0 ? 'text-over' : modelEdgeOver < 0 ? 'text-under' : 'text-muted')
              }
            >
              {signedPct(modelEdgeOver)}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            Our model puts the over at {pct(modelProbOver, 1)} vs the market&apos;s no-vig{' '}
            {pct(consensus.fairProbOver, 1)}. A comparison of two numbers —{' '}
            <strong>not a guarantee</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function BestPriceCard({
  side,
  best,
}: {
  side: string;
  best: MarketConsensus['bestOver'];
}) {
  if (!best) return null;
  const positive = best.evPerDollar != null && best.evPerDollar > 0;
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        Best {side}
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{sourceLabel(best.source)}</span>
        <span className="tabular-nums">{americanOdds(best.odds)}</span>
      </div>
      {best.evPerDollar != null && (
        <div
          className={
            'mt-0.5 text-xs font-medium tabular-nums ' +
            (positive ? 'text-over' : 'text-muted')
          }
        >
          {signedPct(best.evPerDollar)} EV
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </>
  );
}
