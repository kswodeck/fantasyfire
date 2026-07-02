import Link from 'next/link';
import type { Sport } from '@/lib/sports';
import type { InjuryReportRow, TonightGame, TrendRow } from '@/lib/types';
import { sportSections } from '@/lib/sportNav';

/**
 * The sport-home hub grid: one tile per section (Trends, Leaders, Matchups, Injuries,
 * Players — Heat Check has its own teaser above), each with a live one-liner where the
 * data is cheap (tonight's slate, the injury count) and the section's static hint
 * otherwise. Server-rendered; keeps the home page an orientation hub instead of a
 * second copy of the Heat Check board.
 */
export function SportHubTiles({
  sport,
  games,
  slateWord,
  injuries,
  topTrend = null,
}: {
  sport: Sport;
  /** Tonight's (or this week's) slate — [] off-season / on error. */
  games: TonightGame[];
  /** "Today" for daily sports, "This week" for NFL. */
  slateWord: string;
  /** Current injury report — [] when unavailable. */
  injuries: InjuryReportRow[];
  /** The strongest current form swing (shares the board teaser's pool load). */
  topTrend?: TrendRow | null;
}) {
  const sections = sportSections(sport).filter((s) => s.seg !== 'board');
  const outCount = injuries.filter((r) => r.status === 'out').length;

  // Live one-liner per section where the data is already loaded; null → static hint.
  const liveLine = (seg: string): string | null => {
    if (seg === 'trends' && topTrend) {
      const hits = Math.round(topTrend.recentRate * topTrend.recentGames);
      return `Top swing: ${topTrend.player.fullName} — ${hits} of ${topTrend.recentGames} ${topTrend.side} ${topTrend.line} ${topTrend.statShort} (L10)`;
    }
    if (seg === 'matchups' && games.length > 0) {
      const sample = games
        .slice(0, 3)
        .map((g) => `${g.away.abbr ?? '?'} @ ${g.home.abbr ?? '?'}`)
        .join(' · ');
      const more = games.length > 3 ? ` +${games.length - 3}` : '';
      return `${games.length} ${games.length === 1 ? 'game' : 'games'} ${slateWord.toLowerCase()}: ${sample}${more}`;
    }
    if (seg === 'injuries' && injuries.length > 0) {
      return `${injuries.length} ${injuries.length === 1 ? 'player' : 'players'} listed${
        outCount > 0 ? ` · ${outCount} out` : ''
      }`;
    }
    return null;
  };

  return (
    <nav aria-label="Explore sections" className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {sections.map((s) => (
        <Link
          key={s.seg}
          href={`/${sport}/${s.seg}`}
          className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
        >
          <span className="flex items-center gap-1 text-sm font-semibold">
            {s.label}
            <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">
            {liveLine(s.seg) ?? s.desc}
          </span>
        </Link>
      ))}
    </nav>
  );
}
