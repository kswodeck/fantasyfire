import type { TonightGame } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { TeamLogo } from './TeamLogo';
import { MatchupTime } from './MatchupTime';

/** The night's matchups (presentational). MLB rows show probable pitchers. */
export function TonightSlate({ sport, games }: { sport: Sport; games: TonightGame[] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {games.map((g) => (
        <li key={g.externalId} className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <TeamLogo sport={sport} externalId={g.away.externalId} abbr={g.away.abbr} size={18} />
              <span className="font-semibold">{g.away.abbr}</span>
              <span className="text-muted">@</span>
              <TeamLogo sport={sport} externalId={g.home.externalId} abbr={g.home.abbr} size={18} />
              <span className="font-semibold">{g.home.abbr}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] leading-tight text-muted">
              <MatchupTime iso={g.startTime} className="font-medium text-foreground" />
              <span>{g.status}</span>
            </span>
          </div>
          {sport === 'mlb' && (g.awayProbablePitcher || g.homeProbablePitcher) && (
            <div className="mt-1.5 text-[11px] text-muted">
              SP — {g.away.abbr}: {g.awayProbablePitcher ?? 'TBD'} · {g.home.abbr}:{' '}
              {g.homeProbablePitcher ?? 'TBD'}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
