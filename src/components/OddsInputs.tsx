'use client';

/**
 * Optional American-odds inputs for the over/under. Drives the fair-price
 * readout. Empty -> null. Parsing/validation happens upstream; here we just emit
 * the raw number or null.
 */
export function OddsInputs({
  over,
  under,
  onChange,
  allowUnder = true,
}: {
  over: number | null;
  under: number | null;
  onChange: (side: 'over' | 'under', value: number | null) => void;
  /** False for over-only lines (demon/goblin/alternate) — hides the under input. */
  allowUnder?: boolean;
}) {
  function parse(v: string): number | null {
    if (v.trim() === '' || v.trim() === '-' || v.trim() === '+') return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Over odds
        <input
          type="text"
          inputMode="numeric"
          placeholder="-110"
          defaultValue={over ?? ''}
          onChange={(e) => onChange('over', parse(e.target.value))}
          className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-brand"
        />
      </label>
      {allowUnder ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Under odds
          <input
            type="text"
            inputMode="numeric"
            placeholder="-110"
            defaultValue={under ?? ''}
            onChange={(e) => onChange('under', parse(e.target.value))}
            className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-brand"
          />
        </label>
      ) : (
        <span className="pb-1.5 text-xs text-muted">
          Over only — this payout variant doesn&apos;t take an under.
        </span>
      )}
    </div>
  );
}
