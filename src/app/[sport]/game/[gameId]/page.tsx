import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { GameLeans } from '@/components/GameLeans';
import { ParkFactorNote } from '@/components/ParkFactorNote';
import { TeamLogo } from '@/components/TeamLogo';
import { MatchupTime } from '@/components/MatchupTime';
import {
  getBoard,
  getScheduledGame,
  getSourcedBoards,
  getTonightSlate,
  hasUpcomingGames,
} from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { formatIsoDate } from '@/lib/format';
import { SPORTS, isSport, type Sport } from '@/lib/sports';
import type { BoardRow, TonightGame } from '@/lib/types';

export const revalidate = 900; // 15 min — rows come from the same scan as /board
export const dynamicParams = true;

export function generateStaticParams() {
  // Game ids are ephemeral (one slate's worth), so render on demand + ISR-cache rather
  // than pre-building — pre-rendering would run a board scan per game at build time.
  return [];
}

type PageProps = { params: Promise<{ sport: string; gameId: string }> };

async function findGame(sport: Sport, gameId: string): Promise<TonightGame | null> {
  const { games } = await getTonightSlate(sport).catch(() => ({
    date: null,
    games: [] as TonightGame[],
  }));
  return (
    games.find((g) => g.externalId === gameId) ??
    (await getScheduledGame(sport, gameId).catch(() => null))
  );
}

const matchupLabel = (g: TonightGame) => `${g.away.abbr ?? '—'} @ ${g.home.abbr ?? '—'}`;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport, gameId } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const cfg = SPORTS[sport];
  const game = await findGame(sport, gameId);
  const matchup = game ? matchupLabel(game) : 'Game';
  const title = `${matchup} — ${cfg.name} Player Prop Reads`;
  const description = game
    ? `The strongest FireFactor player-prop reads for ${game.away.name ?? game.away.abbr} at ${game.home.name ?? game.home.abbr}, split by team and ranked from public game logs. Free, no login.`
    : `${cfg.name} game reads.`;
  return {
    title,
    description,
    // Ephemeral per-slate URL — worth visiting, not worth indexing (it empties once the
    // game rolls off the slate).
    robots: { index: false, follow: true },
    alternates: { canonical: `/${sport}/game/${gameId}` },
  };
}

export default async function GamePage({ params }: PageProps) {
  const { sport: raw, gameId } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  const upcoming = await hasUpcomingGames(sport).catch(() => true);
  const game = upcoming ? await findGame(sport, gameId) : null;

  const crumbs = (label: string) => (
    <Breadcrumbs
      className="mb-4"
      items={[
        { label: 'Home', href: '/' },
        { label: `${cfg.name} Heat Check`, href: `/${sport}` },
        { label },
      ]}
    />
  );

  // Not on the current slate (already played, or a bad id) → soft fallback, not a 404.
  if (!game) {
    return (
      <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
        {crumbs('Game')}
        <h1 className="text-2xl font-bold tracking-tight">Game not on the current slate</h1>
        <p className="mt-2 text-sm text-muted">
          This matchup isn&rsquo;t on {cfg.name}&rsquo;s upcoming slate — it may have already been
          played. See the{' '}
          <Link href={`/${sport}`} className="text-brand hover:text-brand-strong">
            current {cfg.name} board
          </Link>{' '}
          for live leans.
        </p>
      </div>
    );
  }

  // Real book lines (PrizePicks, …) for this sport, else our median line.
  const sources = await getAvailableSources(sport).catch((): string[] => []);
  const hasSources = sources.length > 0;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);

  const teams = new Set([game.home.abbr, game.away.abbr].filter((a): a is string => !!a));
  const forTeams = (rows: BoardRow[]) =>
    rows.filter((r) => r.player.teamAbbreviation && teams.has(r.player.teamAbbreviation));

  // Same board scan as /board (generous caps so neither team is truncated), then keep
  // only this game's two teams.
  let boardsBySource: Record<string, BoardRow[]> = {};
  let medianRows: BoardRow[] = [];
  try {
    if (hasSources) {
      const all = await getSourcedBoards(sport, sources, { limit: 600, perStatCap: 60 });
      boardsBySource = Object.fromEntries(
        Object.entries(all).map(([s, rows]) => [s, forTeams(rows)]),
      );
    } else {
      medianRows = forTeams(await getBoard(sport, { limit: 600, perStatCap: 60 }));
    }
  } catch {
    // DB unavailable — GameLeans renders its empty state.
  }

  const pitchers =
    sport === 'mlb' && (game.awayProbablePitcher || game.homeProbablePitcher)
      ? `${game.awayProbablePitcher ?? 'TBD'} vs ${game.homeProbablePitcher ?? 'TBD'}`
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      {crumbs(matchupLabel(game))}

      <header className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-center gap-4">
          <TeamSide sport={sport} team={game.away} />
          <span className="text-sm font-semibold text-muted">@</span>
          <TeamSide sport={sport} team={game.home} />
        </div>
        <div className="mt-3 text-center text-xs text-muted">
          <span>{formatIsoDate(game.date)}</span>
          <MatchupTime iso={game.startTime} className="ml-1" />
          {pitchers && <div className="mt-1">Probables: {pitchers}</div>}
        </div>
      </header>

      <h1 className="mt-6 text-xl font-bold tracking-tight">
        {cfg.name} reads · {matchupLabel(game)}
      </h1>
      <p className="mb-5 mt-1 max-w-2xl text-sm text-muted">
        The strongest FireFactor reads for this matchup, split by team.{' '}
        {hasSources
          ? 'Lines are the real book numbers — switch books below.'
          : 'Lines are our own typical-game (median) line, not a sportsbook line.'}
      </p>

      <GameLeans
        sport={sport}
        game={game}
        boardsBySource={boardsBySource}
        sources={sources}
        defaultSource={initialSource}
        medianRows={medianRows}
      />

      {/* Ballpark context for the venue (the home team's park) — MLB only. */}
      {sport === 'mlb' && (
        <div className="mt-6">
          <ParkFactorNote
            teamExternalId={game.home.externalId}
            teamName={game.home.name}
            context="game"
          />
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs, ranked by a sample-size–adjusted FireFactor — not
        predictions, picks, or betting advice. Confirm lineups, scratches, and injuries yourself.
      </p>
    </div>
  );
}

function TeamSide({ sport, team }: { sport: Sport; team: TonightGame['home'] }) {
  return (
    <div className="flex items-center gap-2">
      <TeamLogo sport={sport} externalId={team.externalId} abbr={team.abbr} size={32} />
      <span className="text-lg font-bold">{team.abbr ?? team.name}</span>
    </div>
  );
}
