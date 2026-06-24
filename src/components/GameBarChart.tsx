import type { ChartPoint } from '@/lib/types';
import { num1 } from '@/lib/format';

const COLORS: Record<ChartPoint['result'], string> = {
  over: 'var(--over)',
  under: 'var(--under)',
  push: 'var(--push)',
};

/**
 * Game-by-game bar chart vs. the line. Pure SVG (no deps, no hooks) so it renders
 * identically under SSR and inside a future client-only build. Bars are colored
 * over/under/push; a dashed marker shows the line. Points come in most-recent-
 * first and are drawn oldest → newest (left → right).
 */
export function GameBarChart({
  points,
  line,
  statShort,
}: {
  points: ChartPoint[];
  line: number;
  statShort: string;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
        No games to chart yet.
      </div>
    );
  }

  const chronological = [...points].reverse();
  const n = chronological.length;

  // Layout (SVG units; the SVG scales responsively to its container).
  const m = { top: 22, right: 12, bottom: 40, left: 12 };
  const step = 32;
  const barW = 20;
  const plotH = 160;
  const width = m.left + n * step + m.right;
  const height = m.top + plotH + m.bottom;
  const baselineY = m.top + plotH;

  const maxVal = Math.max(line, ...chronological.map((p) => p.value), 1);
  const yMax = maxVal * 1.15;
  const y = (v: number) => baselineY - (v / yMax) * plotH;
  const lineY = y(line);

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Last ${n} games ${statShort} versus a line of ${line}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Line marker */}
        <line
          x1={m.left}
          x2={width - m.right}
          y1={lineY}
          y2={lineY}
          stroke="var(--foreground)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.6}
        />
        <text
          x={width - m.right}
          y={lineY - 4}
          textAnchor="end"
          fontSize={10}
          fill="var(--muted)"
        >
          line {line}
        </text>

        {chronological.map((p, i) => {
          const x = m.left + i * step + (step - barW) / 2;
          const barY = y(p.value);
          const barH = Math.max(baselineY - barY, 1);
          // Single string child — React requires <title> children to be one
          // string (an array of nodes warns and breaks hydration).
          const tip =
            `${p.gameDate} ${p.isHome ? 'vs' : '@'} ${p.opponentAbbreviation}` +
            `${p.wl ? ` (${p.wl})` : ''}: ${p.value} ${statShort}, ${p.result}` +
            `${p.plusMinus != null ? `, ${p.plusMinus > 0 ? '+' : ''}${p.plusMinus} +/-` : ''}`;
          return (
            <g key={`${p.gameDate}-${i}`}>
              <title>{tip}</title>
              <rect
                x={x}
                y={barY}
                width={barW}
                height={barH}
                rx={2}
                fill={COLORS[p.result]}
              />
              <text
                x={x + barW / 2}
                y={barY - 3}
                textAnchor="middle"
                fontSize={9}
                fill="var(--muted)"
                className="tabular-nums"
              >
                {p.value}
              </text>
              <text
                x={x + barW / 2}
                y={baselineY + 12}
                textAnchor="middle"
                fontSize={8}
                fill="var(--muted)"
              >
                {p.isHome ? '' : '@'}
                {p.opponentAbbreviation}
              </text>
              {p.wl && (
                <text
                  x={x + barW / 2}
                  y={baselineY + 23}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight={600}
                  fill={p.wl === 'W' ? 'var(--over)' : 'var(--under)'}
                >
                  {p.wl}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted">
        Last {n} games — {statShort} per game vs. line {num1(line)}.{' '}
        <span className="text-over">Green = over</span>,{' '}
        <span className="text-under">red = under</span>.
      </figcaption>
    </figure>
  );
}
