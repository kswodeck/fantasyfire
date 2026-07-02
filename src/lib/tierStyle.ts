// Single source of truth for the FireFactor "heat read" + the A–F matchup-grade
// colors. The heat read maps the internal strength tier ('Strong lean' … 'Pass') +
// side to a user-facing word, a flame/snowflake icon, and a warm/cool color:
//   over  = warm flame  — Warm (amber) → Hot (orange) → Blazing (red)
//   under = cool snowflake — Cool (sky) → Cold (blue) → Frozen (indigo)
//   neutral = "No read" (muted). Deeper color = stronger edge.
// All colors are theme-aware tokens (globals.css light-dark() pairs, WCAG-AA in both
// modes); the icon inherits via currentColor.
type Side = 'over' | 'under';

const isNeutral = (tier: string) => tier === 'No lean' || tier === 'Pass';

/** The user-facing heat word for a (strength tier, side). */
export function heatLabel(tier: string, side: Side): string {
  if (isNeutral(tier)) return 'No read';
  if (side === 'over') {
    if (tier === 'Strong lean') return 'Blazing';
    if (tier === 'Lean') return 'Hot';
    return 'Warm';
  }
  if (tier === 'Strong lean') return 'Frozen';
  if (tier === 'Lean') return 'Cold';
  return 'Cool';
}

/**
 * Value-framing label for payout-variant rows — an "over lean" is meaningless on an
 * over-only line, so variant reads speak in value terms: how well the rung beats its
 * payout breakeven (0 = fairly priced). Standard lines keep the heat words above.
 */
export function valueLabel(tier: string): string {
  if (tier === 'Strong lean') return 'Strong value';
  if (tier === 'Lean') return 'Value';
  if (tier === 'Slight lean') return 'Slight value';
  if (tier === 'No lean') return 'Fair price';
  return 'No read';
}

/** Which glyph HeatIcon (LeanArrow) should draw. */
export function heatIcon(tier: string, side: Side): 'flame' | 'snowflake' | 'dash' {
  if (isNeutral(tier)) return 'dash';
  return side === 'over' ? 'flame' : 'snowflake';
}

/** Text/icon color class for a tier + side (warm = over, cool = under). */
export function tierTextClass(tier: string, side: Side): string {
  if (isNeutral(tier)) return 'text-muted';
  if (side === 'over') {
    if (tier === 'Strong lean') return 'text-heat-3';
    if (tier === 'Lean') return 'text-heat-2';
    return 'text-heat-1';
  }
  if (tier === 'Strong lean') return 'text-ice-3';
  if (tier === 'Lean') return 'text-ice-2';
  return 'text-ice-1';
}

/** Border + fill tint for the verdict-panel box, by tier + side. Low-opacity tints
 * read correctly on both light and dark. */
export function tierBoxClass(tier: string, side: Side): string {
  if (isNeutral(tier)) return 'border-line bg-surface-2';
  if (side === 'over') {
    if (tier === 'Strong lean') return 'border-heat-3/30 bg-heat-3/10';
    if (tier === 'Lean') return 'border-heat-2/25 bg-heat-2/[0.07]';
    return 'border-heat-1/25 bg-heat-1/[0.07]';
  }
  if (tier === 'Strong lean') return 'border-ice-3/30 bg-ice-3/10';
  if (tier === 'Lean') return 'border-ice-2/25 bg-ice-2/[0.07]';
  return 'border-ice-1/25 bg-ice-1/[0.07]';
}

/** Text color for an A–F matchup grade (A = softest/green, F = toughest/red). */
export function gradeTextClass(grade: string): string {
  switch (grade) {
    case 'A':
      return 'text-sig-green-strong';
    case 'B':
      return 'text-sig-green';
    case 'C':
      return 'text-sig-amber';
    case 'D':
      return 'text-sig-orange';
    case 'F':
      return 'text-sig-red-strong';
    default:
      return 'text-muted'; // NR
  }
}
