import type { PlayerVerdict } from '@/lib/types';
import type { ProjectionAdjustments } from '@/lib/stats';
import { num1, pct } from '@/lib/format';
import { LeanArrow } from './LeanArrow';
import { tierTextClass, tierBoxClass, gradeTextClass, heatLabel } from '@/lib/tierStyle';

/** Spell out which context factors moved the projection — hover text for the
 *  "(×0.95 context)" chip. For MLB hitters the opponent factor prefers the
 *  probable opposing STARTER over the staff-wide grade, so it can legitimately
 *  disagree with the Matchup letter below (a soft staff, a tough starter). */
function factorBreakdown(factors: ProjectionAdjustments | undefined): string {
  const parts: string[] = [];
  const add = (label: string, v: number | null | undefined) => {
    if (v != null && Number.isFinite(v) && Math.abs(v - 1) >= 0.005) {
      parts.push(`${label} ×${v.toFixed(2)}`);
    }
  };
  add('opponent', factors?.opponent);
  add('pace', factors?.pace);
  add('Vegas total', factors?.environment);
  add('usage trend', factors?.volume);
  const detail = parts.length ? parts.join(' · ') : 'no individual factor moved it';
  return (
    `Context multiplier on the recent-form base: ${detail}. ` +
    `For MLB hitters the opponent factor uses the probable opposing starter when known, ` +
    `so it can differ from the team-wide Matchup grade below.`
  );
}

/**
 * The "verdict" read for a player + stat + line. Presentational only (data via
 * props). Honesty contract: the tier label leads, the FireFactor number is
 * secondary and never shown without its component breakdown, every estimate is a
 * range, and the descriptive/responsible-gaming disclosure sits adjacent.
 */
export function VerdictPanel({
  verdict,
  statShort,
  statLabel,
  line,
}: {
  verdict: PlayerVerdict;
  statShort: string;
  /** Full stat name ("Walks", "Strikeouts (batter)") — spelled out next to the
   *  abbreviation so the prop is never a mystery code. */
  statLabel?: string;
  line: number;
}) {
  const { fireScore, projection, consistency, matchupGrade, modelProbOver } = verdict;
  // Probability the leaning side hits, from the projection's distribution.
  const modelProbSide =
    modelProbOver == null ? null : fireScore.side === 'over' ? modelProbOver : 1 - modelProbOver;
  const adjusted = projection.adjustment !== 1 && projection.projection != null;
  const tierText = tierTextClass(fireScore.tier, fireScore.side);
  const tierBox = tierBoxClass(fireScore.tier, fireScore.side);
  const headline =
    fireScore.tier === 'Pass' || fireScore.tier === 'No lean'
      ? 'No read'
      : `${heatLabel(fireScore.tier, fireScore.side)} ${fireScore.side}`;

  return (
    <section aria-label="Verdict" className={`mb-6 rounded-xl border p-4 ${tierBox}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Verdict</h2>
        <span className="text-right text-xs text-muted">
          vs {line} {statShort}
          {statLabel && <span className="block text-[10px]">{statLabel}</span>}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`inline-flex items-center gap-1.5 text-2xl font-bold tracking-tight ${tierText}`}
        >
          <LeanArrow tier={fireScore.tier} side={fireScore.side} size={22} />
          {headline}
        </span>
        <span className="text-sm tabular-nums text-muted">FireFactor {fireScore.score}/100</span>
        {modelProbSide != null && (
          <span className="text-sm tabular-nums text-muted">
            · model {pct(modelProbSide)} {fireScore.side}
          </span>
        )}
      </div>

      {/* Component breakdown — the number is never shown without this. Every bar is
          EVIDENCE FOR THE LEANING SIDE (50 = neutral/abstains), so a favorable
          matchup reads ~0 on an under lean — that's the matchup arguing for the
          over, not missing data. The suffix word spells that out. */}
      <div className="mt-3 space-y-1.5">
        {fireScore.components.map((c) => {
          const word =
            c.score >= 0.6 ? 'supports it' : c.score <= 0.4 ? 'argues against it' : 'neutral';
          return (
            <div
              key={c.key}
              className="flex items-center gap-2 text-xs"
              title={`Each bar is evidence for the ${fireScore.side} lean: 50 is neutral (it abstains), higher supports the ${fireScore.side}, lower argues against it. Example: a soft matchup scores low on an under lean because it favors the over.`}
            >
              <span className="w-28 shrink-0 text-muted sm:w-40">{c.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${Math.round(c.score * 100)}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted">
                {Math.round(c.score * 100)}
              </span>
              <span className="hidden w-24 shrink-0 text-right text-[10px] text-muted sm:block">
                {word}
              </span>
            </div>
          );
        })}
      </div>

      {/* Sub-reads: estimate range, consistency, matchup. */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Projection
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {num1(projection.projection)} {statShort}
            {adjusted && (
              <span
                className="ml-1 font-normal text-[11px] text-muted"
                title={factorBreakdown(projection.factors)}
              >
                (×{projection.adjustment.toFixed(2)} context)
              </span>
            )}
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
          <div className={`text-sm font-semibold ${matchupGrade ? gradeTextClass(matchupGrade) : 'text-muted'}`}>
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
        {fireScore.note} Small samples and hot streaks are discounted by a 95% Wilson lower
        bound (the trust factor), so a thin streak can&rsquo;t masquerade as an edge.
      </p>
    </section>
  );
}
