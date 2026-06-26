'use client';

import Link from 'next/link';
import { useSavedProps } from '@/hooks/useSavedProps';
import { isPropSaved, toggleSavedProp, type PropSide } from '@/lib/savedProps';
import { sourceLabel } from '@/lib/providedSources';
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
  /** The upcoming game this pick is for, so it can auto-expire once it's over. */
  gameDate: string | null;
  gameStartTime: string | null;
}) {
  const { props } = useSavedProps();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        {(['over', 'under'] as PropSide[]).map((side) => {
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
