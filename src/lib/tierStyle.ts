// Single source of truth for FireScore tier colors so the board, slate, and
// verdict panel never drift. The scale steps by strength from the amber
// "Slight lean": amber → a lighter green (Lean) → a deeper emerald (Strong lean).
export const TIER_TEXT: Record<string, string> = {
  'Strong lean': 'text-emerald-400',
  Lean: 'text-green-300',
  'Slight lean': 'text-amber-300',
  'No lean': 'text-muted',
  Pass: 'text-muted',
};

/** Panel border + fill tint per tier (the verdict panel box). */
export const TIER_BOX: Record<string, string> = {
  'Strong lean': 'border-emerald-500/30 bg-emerald-500/10',
  Lean: 'border-green-500/25 bg-green-500/[0.07]',
  'Slight lean': 'border-amber-500/25 bg-amber-500/[0.07]',
  'No lean': 'border-line bg-surface-2',
  Pass: 'border-line bg-surface-2',
};
