import type { TeammateSplit } from '@/lib/types';
import { num1, pct } from '@/lib/format';

/**
 * Injury cascade — how this player's line shifts when an impactful teammate is OUT
 * (live injuries × our box scores). Usage often rises when a starter sits, and this
 * shows the real with/without history. Descriptive splits, not a forecast.
 */
export function TeammateSplitsPanel({
  splits,
  statShort,
  line,
}: {
  splits: TeammateSplit[];
  statShort: string;
  line: number;
}) {
  if (splits.length === 0) return null;

  return (
    <section
      aria-label="With a teammate out"
      className="mb-6 rounded-xl border border-line bg-surface p-4"
    >
      <h3 className="text-sm font-semibold">With a teammate out</h3>
      <p className="mt-1 text-xs text-muted">
        How this {statShort} line has shifted when an injured teammate sits — usage often rises.
        Descriptive splits from past games, not a forecast.
      </p>
      <div className="mt-3 space-y-3">
        {splits.map((s) => {
          const delta =
            s.without.mean != null && s.withTeammate.mean != null
              ? s.without.mean - s.withTeammate.mean
              : null;
          const up = delta != null && delta > 0;
          return (
            <div key={s.name} className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-sm font-medium">
                  {s.name} out
                  {s.detail && <span className="text-xs font-normal text-muted"> · {s.detail}</span>}
                </span>
                {delta != null && Math.abs(delta) >= 0.1 && (
                  <span className={`text-xs font-medium tabular-nums ${up ? 'text-over' : 'text-under'}`}>
                    {up ? '+' : ''}
                    {num1(delta)} {statShort} when he sits
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Side label={`Without (${s.without.games}g)`} split={s.without} statShort={statShort} line={line} highlight />
                <Side label={`With (${s.withTeammate.games}g)`} split={s.withTeammate} statShort={statShort} line={line} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Side({
  label,
  split,
  statShort,
  line,
  highlight,
}: {
  label: string;
  split: TeammateSplit['without'];
  statShort: string;
  line: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${highlight ? 'text-foreground' : 'text-muted'}`}>
        {num1(split.mean)} {statShort}
      </div>
      <div className="text-[11px] text-muted">
        {pct(split.hitRateOver)} over {line}
      </div>
    </div>
  );
}
