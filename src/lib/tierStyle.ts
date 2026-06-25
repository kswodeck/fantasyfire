// Single source of truth for FireScore tier colors (board, slate, verdict panel,
// and — via currentColor — the lean arrows). Color encodes BOTH:
//   • direction — green = Over, red = Under
//   • strength  — deeper at Strong lean, warming toward yellow/orange as the lean
//     weakens to Slight lean.
// "No lean"/"Pass" are muted. Every shade is chosen to clear WCAG-AA contrast on
// the dark surface (the deepest, red-500/orange-500/emerald-400, sit ~5:1+).
type Side = 'over' | 'under';

/** Text/icon color class for a tier + side (the arrow inherits this via currentColor). */
export function tierTextClass(tier: string, side: Side): string {
  if (tier === 'No lean' || tier === 'Pass') return 'text-muted';
  if (side === 'over') {
    if (tier === 'Strong lean') return 'text-emerald-400'; // deep green
    if (tier === 'Lean') return 'text-green-300'; // lighter green
    return 'text-amber-400'; // Slight lean — darker yellow
  }
  // red-400 (not red-500) for Strong so the small text clears WCAG-AA even on the
  // lighter hover row background (#292524); red-500 fails there (4.0:1).
  if (tier === 'Strong lean') return 'text-red-400'; // dark red
  if (tier === 'Lean') return 'text-red-300'; // lighter red
  return 'text-orange-500'; // Slight lean — dark orange
}

/** Border + fill tint for the verdict-panel box, by tier + side. */
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
