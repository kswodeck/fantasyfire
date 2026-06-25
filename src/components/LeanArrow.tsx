import type { FireScoreResult } from '@/lib/stats';

// Chevron-arrow glyphs on a 16×16 grid. `up` = over, `down` = under, `flat` =
// no directional lean. Stroked with currentColor so the arrow inherits whatever
// tier color it sits next to (emerald lean / amber slight / muted no-lean).
const PATHS = {
  up: 'M8 13V3M4 7l4-4 4 4',
  down: 'M8 3v10M4 9l4 4 4-4',
  flat: 'M3 8h10',
} as const;

/**
 * Directional lean indicator next to a FireScore tier: ↑ for an over lean, ↓ for
 * an under lean, and a flat — when there is no lean (No lean / Pass). Color is
 * inherited from the surrounding tier label.
 */
export function LeanArrow({
  tier,
  side,
  size = 14,
  className = '',
}: {
  tier: FireScoreResult['tier'];
  side: FireScoreResult['side'];
  size?: number;
  className?: string;
}) {
  const dir = tier === 'No lean' || tier === 'Pass' ? 'flat' : side === 'over' ? 'up' : 'down';
  const label =
    dir === 'flat' ? 'No directional lean' : dir === 'up' ? 'Leaning over' : 'Leaning under';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label={label}
    >
      <path d={PATHS[dir]} />
    </svg>
  );
}
