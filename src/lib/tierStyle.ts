// Single source of truth for FireScore tier + matchup-grade colors. All colors
// are theme-aware signal tokens (defined in globals.css as light-dark() pairs,
// WCAG-AA in both modes): green = over/good, red = under/tough, deeper at the
// strong end and warming to amber/orange. The lean arrow inherits via currentColor.
type Side = 'over' | 'under';

/** Text/icon color class for a tier + side. */
export function tierTextClass(tier: string, side: Side): string {
  if (tier === 'No lean' || tier === 'Pass') return 'text-muted';
  if (side === 'over') {
    if (tier === 'Strong lean') return 'text-sig-green-strong';
    if (tier === 'Lean') return 'text-sig-green';
    return 'text-sig-amber'; // Slight lean
  }
  if (tier === 'Strong lean') return 'text-sig-red-strong';
  if (tier === 'Lean') return 'text-sig-red';
  return 'text-sig-orange'; // Slight lean
}

/** Border + fill tint for the verdict-panel box, by tier + side. Decorative
 * tints (low-opacity palette colors) read correctly on both light and dark. */
export function tierBoxClass(tier: string, side: Side): string {
  if (tier === 'No lean' || tier === 'Pass') return 'border-line bg-surface-2';
  if (side === 'over') {
    if (tier === 'Strong lean') return 'border-emerald-500/30 bg-emerald-500/10';
    if (tier === 'Lean') return 'border-green-500/25 bg-green-500/[0.07]';
    return 'border-amber-500/25 bg-amber-500/[0.07]';
  }
  if (tier === 'Strong lean') return 'border-red-500/30 bg-red-500/10';
  if (tier === 'Lean') return 'border-red-500/25 bg-red-500/[0.07]';
  return 'border-orange-500/25 bg-orange-500/[0.07]';
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
