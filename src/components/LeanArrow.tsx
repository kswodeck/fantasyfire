import type { FireFactorResult } from '@/lib/stats';
import { heatIcon, heatLabel } from '@/lib/tierStyle';

// The FireFactor heat glyph on a 24×24 grid: a filled flame for an over read, a
// stroked snowflake for an under read, and a flat dash for "No read". Color is
// inherited from the surrounding heat-tier label via currentColor, so the same icon
// reads amber→red (over) or sky→indigo (under) by its context.
const FLAME =
  'M12 2c.6 3.2-1.3 4.7-2.8 6.2C7.7 9.7 6 11.2 6 14a6 6 0 0 0 12 0c0-2-1-3.7-2.2-5-.5 1-1.3 1.6-2.3 1.7.8-2.2.3-4.6-1.5-6.4-.8-.8-1.4-1.6-1.7-2.3Z';
const SNOWFLAKE =
  'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.8 6.4l.3 3.1M18.2 6.4l-.3 3.1M5.8 17.6l.3-3.1M18.2 17.6l-.3-3.1';

/**
 * Directional heat indicator next to a FireFactor tier: a flame for an over lean, a
 * snowflake for an under lean, a dash for No read. Inherits the tier color.
 */
export function LeanArrow({
  tier,
  side,
  size = 14,
  className = '',
}: {
  tier: FireFactorResult['tier'];
  side: FireFactorResult['side'];
  size?: number;
  className?: string;
}) {
  const glyph = heatIcon(tier, side);
  const label = glyph === 'dash' ? 'No directional read' : `${heatLabel(tier, side)} ${side}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label={label}
    >
      {glyph === 'flame' ? (
        <path d={FLAME} fill="currentColor" />
      ) : (
        <path
          d={glyph === 'snowflake' ? SNOWFLAKE : 'M5 12h14'}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
