'use client';

import Link from 'next/link';
import type { TonightGame } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { TeamLogo } from './TeamLogo';
import { MatchupTime } from './MatchupTime';

/**
 * Condensed, clickable matchups strip. Each game is a compact chip (away @ home + start
 * time) so the whole slate fits in a row or two. The chip body toggles the game as a
 * board filter; the ↗ on its right opens the full per-game leans page. Selected chips
 * are highlighted.
 */
export function MatchupStrip({
  sport,
  games,
  selected,
  onToggle,
}: {
  sport: Sport;
  games: TonightGame[];
  selected: Set<string>;
  onToggle: (externalId: string) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {games.map((g) => {
        const isSel = selected.has(g.externalId);
        const label = `${g.away.abbr} @ ${g.home.abbr}`;
        return (
          <li key={g.externalId}>
            <div
              className={
                'inline-flex items-stretch overflow-hidden rounded-lg border text-xs transition-colors ' +
                (isSel
                  ? 'border-brand bg-brand/10'
                  : 'border-line bg-surface hover:border-brand/60')
              }
            >
              <button
                type="button"
                onClick={() => onToggle(g.externalId)}
                aria-pressed={isSel}
                title={`Filter the reads to ${label}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-foreground"
              >
                <TeamLogo sport={sport} externalId={g.away.externalId} abbr={g.away.abbr} size={15} />
                <span className="font-semibold">{g.away.abbr}</span>
                <span className="text-muted">@</span>
                <TeamLogo sport={sport} externalId={g.home.externalId} abbr={g.home.abbr} size={15} />
                <span className="font-semibold">{g.home.abbr}</span>
                <MatchupTime iso={g.startTime} className="ml-0.5 text-muted" />
              </button>
              <Link
                href={`/${sport}/game/${g.externalId}`}
                title={`Open the ${label} game page`}
                aria-label={`Open the ${label} game page`}
                className="flex min-w-[36px] items-center justify-center border-l border-line px-2.5 text-muted transition-colors hover:bg-brand/10 hover:text-brand"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
