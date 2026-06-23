import type { FairPriceReadout as FairPrice } from '@/lib/odds';
import { pct, americanOdds } from '@/lib/format';

function signedPct(x: number): string {
  const v = (x * 100).toFixed(1);
  return x >= 0 ? `+${v}%` : `${v}%`;
}

/**
 * Fair-price readout (PLAN §5d). Shows implied probability, no-vig fair price
 * (when both sides are entered), and the edge vs. the historical hit rate.
 * Honestly labelled: historical-vs-price, NOT a guarantee.
 */
export function FairPriceReadout({
  readout,
  historicalHitRate,
  historicalLabel,
}: {
  readout: FairPrice;
  /** The historical over hit rate the edge was measured against (0..1). */
  historicalHitRate: number | null;
  /** Label for that hit rate, e.g. "L10 hit rate (over)". */
  historicalLabel: string;
}) {
  const bothSides = readout.fairOver !== null;
  const edge = readout.edge;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold">Fair price</h3>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {readout.impliedOver !== null && (
          <Row label="Implied (over)" value={pct(readout.impliedOver, 1)} />
        )}
        {readout.impliedUnder !== null && (
          <Row label="Implied (under)" value={pct(readout.impliedUnder, 1)} />
        )}
        {bothSides && (
          <>
            <Row label="No-vig fair (over)" value={pct(readout.fairOver, 1)} />
            <Row label="No-vig fair (under)" value={pct(readout.fairUnder, 1)} />
            {readout.overround !== null && (
              <Row label="Hold (vig)" value={pct(readout.overround - 1, 1)} />
            )}
          </>
        )}
        {readout.fairAmericanOver !== null && (
          <Row label="Fair odds (over)" value={americanOdds(readout.fairAmericanOver)} />
        )}
      </dl>

      {edge !== null && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Edge on the over</span>
            <span
              className={
                'text-lg font-bold tabular-nums ' +
                (edge > 0 ? 'text-over' : edge < 0 ? 'text-under' : 'text-muted')
              }
            >
              {signedPct(edge)}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            {historicalLabel} {pct(historicalHitRate, 1)} vs.{' '}
            {bothSides ? 'no-vig fair' : 'implied'} price{' '}
            {pct(readout.referenceProbOver, 1)}. Based on recent history vs. the price
            you entered — <strong>not a guarantee</strong>.
          </p>
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
