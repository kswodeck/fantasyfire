'use client';

import Link from 'next/link';
import { useSavedProps } from '@/hooks/useSavedProps';
import { isPropSaved, toggleSavedProp, type PropSide } from '@/lib/savedProps';
import { sourceLabel } from '@/lib/providedSources';
import { isOverOnly } from '@/lib/payoutVariant';
import { PayoutBadge } from './PayoutBadge';
import { track } from '@/lib/analytics';
import type { StatKey } from '@/lib/stats';
import type { Sport } from '@/lib/sports';

/**
 * Compact, inline prop saver — sits beside the Line input. Saves a specific
 * (player, stat, line, side) at the SELECTED book to the device-local Playbook. Saves
 * are per-source; Over/Under are mutually exclusive per line per source (toggling one
 * drops the other at that book). Independent of the whole-player ★ favorite.
 */
export function SavePropControl({
  sport,
  slug,
  name,
  team,
  stat,
  line,
  source,
  oddsType = null,
  multiplier = null,
  gameDate,
  gameStartTime,
}: {
  sport: Sport;
  slug: string;
  name: string;
  team?: string | null;
  stat: StatKey;
  line: number;
  /** The book this save is for — the page's selected source. */
  source: string;
  /** Payout-variant tag of the current line (goblin/demon/alternate); null = plain. */
  oddsType?: string | null;
  /** Exact payout multiplier of the current line (UD alternates); null when none. */
  multiplier?: number | null;
  /** The upcoming game this pick is for, so it can auto-expire once it's over. */
  gameDate: string | null;
  gameStartTime: string | null;
}) {
  const { props } = useSavedProps();
  // Demon/goblin/alternate lines only pay the over — no under to save.
  const overOnly = oddsType != null && isOverOnly(oddsType);
  const sides: PropSide[] = overOnly ? ['over'] : ['over', 'under'];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        {sides.map((side) => {
          const saved = isPropSaved(props, { sport, slug, stat, line, side, source });
          return (
            <button
              key={side}
              type="button"
              aria-pressed={saved}
              aria-label={
                saved
                  ? `Remove ${name} ${side} ${line} (${sourceLabel(source)}) from your Playbook`
                  : `Save ${name} ${side} ${line} (${sourceLabel(source)}) to your Playbook`
              }
              title={saved ? 'Saved — click to remove' : 'Save to My Playbook'}
              onClick={() => {
                const now = toggleSavedProp({
                  sport,
                  slug,
                  name,
                  team,
                  stat,
                  line,
                  side,
                  source,
                  oddsType,
                  multiplier,
                  gameDate,
                  gameStartTime,
                });
                if (now) track('prop_saved', { sport, stat, side, source });
              }}
              className={
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ' +
                (saved
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-line bg-surface text-muted hover:text-foreground')
              }
            >
              <span aria-hidden="true">{saved ? '★' : '☆'}</span>
              <span className="tabular-nums">
                {side} {line}
              </span>
              <PayoutBadge oddsType={oddsType} multiplier={multiplier} showLabel={false} glyphSize={11} />
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted">
        Save this {sourceLabel(source)} prop to your{' '}
        <Link
          href="/playbook"
          className="font-medium text-brand underline-offset-2 hover:text-brand-strong hover:underline"
        >
          Playbook
        </Link>{' '}
        to track it
      </span>
    </div>
  );
}
