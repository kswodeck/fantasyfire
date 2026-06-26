'use client';

import type { TonightGame } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { TeamLogo } from './TeamLogo';
import { MatchupTime } from './MatchupTime';

/**
 * Condensed, clickable matchups strip. Each game is a compact chip (away @ home +
 * start time) so the whole slate fits in a row or two. Clicking a chip toggles it as
 * a filter; selected chips are highlighted. (Pitchers / deeper context live on the
 * player pages — and, later, per-game detail pages.)
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
        return (
          <li key={g.externalId}>
            <button
              type="button"
              onClick={() => onToggle(g.externalId)}
              aria-pressed={isSel}
              title={`${g.away.abbr} @ ${g.home.abbr}`}
              className={
                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors ' +
                (isSel
                  ? 'border-brand bg-brand/10 text-foreground'
                  : 'border-line bg-surface text-foreground hover:border-brand/60')
              }
            >
              <TeamLogo sport={sport} externalId={g.away.externalId} abbr={g.away.abbr} size={15} />
              <span className="font-semibold">{g.away.abbr}</span>
              <span className="text-muted">@</span>
              <TeamLogo sport={sport} externalId={g.home.externalId} abbr={g.home.abbr} size={15} />
              <span className="font-semibold">{g.home.abbr}</span>
              <MatchupTime iso={g.startTime} className="ml-0.5 text-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
