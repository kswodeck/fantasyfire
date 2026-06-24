import type { PlayerVerdict } from '@/lib/types';
import { num1 } from '@/lib/format';

const TIER_STYLE: Record<string, { text: string; box: string }> = {
  'Strong lean': { text: 'text-emerald-300', box: 'border-emerald-500/30 bg-emerald-500/10' },
  Lean: { text: 'text-emerald-300', box: 'border-emerald-500/25 bg-emerald-500/[0.07]' },
  'Slight lean': { text: 'text-amber-300', box: 'border-amber-500/25 bg-amber-500/[0.07]' },
  'No lean': { text: 'text-muted', box: 'border-line bg-surface-2' },
  Pass: { text: 'text-muted', box: 'border-line bg-surface-2' },
};

const GRADE_TEXT: Record<string, string> = {
  A: 'text-emerald-300',
  B: 'text-emerald-300',
  C: 'text-amber-300',
  D: 'text-orange-300',
  F: 'text-red-300',
  NR: 'text-muted',
};

/**
 * The "verdict" read for a player + stat + line. Presentational only (data via
 * props). Honesty contract: the tier label leads, the FireScore number is
 * secondary and never shown without its component breakdown, every estimate is a
 * range, and the descriptive/responsible-gaming disclosure sits adjacent.
 */
export function VerdictPanel({
  verdict,
  statShort,
  line,
}: {
  verdict: PlayerVerdict;
  statShort: string;
  line: number;
}) {
  const { fireScore, projection, consistency, matchupGrade } = verdict;
  const tier = TIER_STYLE[fireScore.tier] ?? TIER_STYLE['No lean'];
  const headline =
    fireScore.tier === 'Pass'
      ? 'Pass'
      : `${fireScore.side === 'over' ? 'Over' : 'Under'} — ${fireScore.tier}`;

  return (
    <section aria-label="Verdict" className={`mb-6 rounded-xl border p-4 ${tier.box}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Verdict
          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            experimental
          </span>
        </h3>
        <span className="text-xs text-muted">
          vs {line} {statShort}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-2xl font-bold tracking-tight ${tier.text}`}>{headline}</span>
        <span className="text-sm tabular-nums text-muted">FireScore {fireScore.score}/100</span>
      </div>

      {/* Component breakdown — the number is never shown without this. */}
      <div className="mt-3 space-y-1.5">
        {fireScore.components.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-xs">
            <span className="w-40 shrink-0 text-muted">{c.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${Math.round(c.score * 100)}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted">
              {Math.round(c.score * 100)}
            </span>
          </div>
        ))}
      </div>

      {/* Sub-reads: estimate range, consistency, matchup. */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Recent-form est.
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {num1(projection.stabilized)} {statShort}
          </div>
          <div className="text-[11px] text-muted">
            L5 {num1(projection.rawL5)} · L10 {num1(projection.rawL10)} · med{' '}
            {num1(projection.medianL10)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Consistency
          </div>
          <div className="text-sm font-semibold">{consistency.badge}</div>
          <div className="text-[11px] text-muted">
            floor {num1(consistency.floor)} · ceil {num1(consistency.ceiling)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Matchup
          </div>
          <div className={`text-sm font-semibold ${matchupGrade ? GRADE_TEXT[matchupGrade] : 'text-muted'}`}>
            {matchupGrade ?? '—'}
          </div>
          <div className="text-[11px] text-muted">
            {matchupGrade === 'NR'
              ? 'small sample'
              : matchupGrade
                ? 'defense vs role'
                : 'no matchup'}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {fireScore.note} Ranked by the lower bound of a 95% confidence interval, so small
        samples and hot streaks are discounted. 21+. Problem gambling? Call 1-800-GAMBLER.
      </p>
    </section>
  );
}
