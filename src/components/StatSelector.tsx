'use client';

import { STAT_DEFS, STAT_KEYS, type StatKey } from '@/lib/stats';

/** Chip row for picking the stat to research. */
export function StatSelector({
  value,
  onChange,
}: {
  value: StatKey;
  onChange: (stat: StatKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Choose stat">
      {STAT_KEYS.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(k)}
            title={STAT_DEFS[k].label}
            className={
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
              (active
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-line bg-surface text-muted hover:border-brand/50 hover:text-foreground')
            }
          >
            {STAT_DEFS[k].short}
          </button>
        );
      })}
    </div>
  );
}
