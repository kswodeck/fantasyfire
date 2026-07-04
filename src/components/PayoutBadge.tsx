// Payout-variant badge + glyphs. Shows a PrizePicks demon (red, harder line /
// boosted payout) or goblin (green, easier line / reduced payout), or an Underdog
// alternate's exact numeric multiplier (e.g. 1.31×). Renders nothing for a plain
// line. Colors are theme tokens (--demon / --goblin, heat-1/ice-1 for the multiplier).
import { payoutKind, type PayoutKind } from '@/lib/payoutVariant';

/** "1.31×" with trailing zeros trimmed (1.5 → "1.5×", 2 → "2×"). */
export function formatMultiplier(m: number): string {
  return `${parseFloat(m.toFixed(2))}×`;
}

/**
 * Demon (horned head) / goblin (big-eared head) silhouette in currentColor, so the
 * parent's text color drives it. Sized in px; inherits color from the wrapper.
 */
export function PayoutGlyph({
  kind,
  size = 14,
  className = '',
}: {
  kind: 'demon' | 'goblin';
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {kind === 'demon' ? (
        <>
          {/* horns */}
          <path d="M6.6 8.2 L8.4 3.6 L10.2 8.4 Z" />
          <path d="M17.4 8.2 L15.6 3.6 L13.8 8.4 Z" />
          {/* head with a slightly pointed chin */}
          <path d="M12 6.5 C16 6.5 18.5 9.2 18.5 12.6 C18.5 16.4 15.5 19.8 12 21.4 C8.5 19.8 5.5 16.4 5.5 12.6 C5.5 9.2 8 6.5 12 6.5 Z" />
        </>
      ) : (
        <>
          {/* big pointed ears */}
          <path d="M7.2 10.5 L1.8 7 L8 9.4 Z" />
          <path d="M16.8 10.5 L22.2 7 L16 9.4 Z" />
          {/* rounder friendly head */}
          <circle cx="12" cy="13.2" r="6.6" />
        </>
      )}
    </svg>
  );
}

const PILL = 'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none';

/**
 * The payout badge for a line. `showLabel` adds the "pays more/less" words next to
 * the PrizePicks glyph (used on cards); off for tight spots. Returns null for a plain
 * line so callers can render it unconditionally.
 */
export function PayoutBadge({
  oddsType,
  multiplier,
  showLabel = true,
  glyphSize = 13,
  className = '',
}: {
  oddsType: string | null | undefined;
  multiplier?: number | null;
  showLabel?: boolean;
  glyphSize?: number;
  className?: string;
}) {
  const kind: PayoutKind = payoutKind(oddsType);

  if (kind === 'demon') {
    return (
      <span
        // Glyph-only mode is otherwise invisible to screen readers (the SVG is
        // decorative and the demon/goblin difference is color + silhouette).
        {...(showLabel ? {} : { 'aria-label': 'Demon line — pays more' })}
        className={`${PILL} bg-demon/12 text-demon ${className}`}
      >
        <PayoutGlyph kind="demon" size={glyphSize} />
        {showLabel && <span>pays more</span>}
      </span>
    );
  }
  if (kind === 'goblin') {
    return (
      <span
        {...(showLabel ? {} : { 'aria-label': 'Goblin line — pays less' })}
        className={`${PILL} bg-goblin/12 text-goblin ${className}`}
      >
        <PayoutGlyph kind="goblin" size={glyphSize} />
        {showLabel && <span>pays less</span>}
      </span>
    );
  }
  if (kind === 'alternate' && multiplier != null) {
    const boosted = multiplier >= 1;
    return (
      <span
        className={`${PILL} tabular-nums ${boosted ? 'bg-heat-1/12 text-heat-1' : 'bg-ice-1/12 text-ice-1'} ${className}`}
        title={`Underdog alternate — ${formatMultiplier(multiplier)} payout`}
      >
        <span aria-hidden="true">{boosted ? '↗' : '↘'}</span>
        {formatMultiplier(multiplier)}
      </span>
    );
  }
  // A default/standard line can still carry a non-standard payout multiplier
  // (Underdog posts one per line) — surface it whenever it isn't the plain 1×.
  if (kind === 'normal' && multiplier != null && multiplier !== 1) {
    const boosted = multiplier >= 1;
    return (
      <span
        className={`${PILL} tabular-nums ${boosted ? 'bg-heat-1/12 text-heat-1' : 'bg-ice-1/12 text-ice-1'} ${className}`}
        title={`Standard line — ${formatMultiplier(multiplier)} payout`}
      >
        {formatMultiplier(multiplier)}
      </span>
    );
  }
  return null; // plain line — no badge
}
