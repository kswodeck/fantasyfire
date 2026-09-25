import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BoardRow } from '@/lib/types';

// The regression: the social board was computed LEAGUE-WIDE and capped (limit 40)
// before leansFromRows filtered it to the teams playing today. On a slate that is
// most of the league (a 15-game MLB night) nothing is lost. On an NFL Thursday —
// 2 teams out of 32 — the cap is spent almost entirely on players who aren't
// playing, so the filter leaves nothing and the sport never posts.

vi.mock('@/lib/db', () => ({
  db: {
    scheduledGame: { findMany: vi.fn() },
    team: { findMany: vi.fn(async () => []) },
    ingestRun: { findFirst: vi.fn(async () => null) },
  },
}));
vi.mock('@/lib/server/players', () => ({
  getBoard: vi.fn(),
  getSourcedBoards: vi.fn(),
  getTonightSlate: vi.fn(async () => ({ date: null, games: [] })),
  getTrendBoard: vi.fn(async () => []),
}));
vi.mock('@/lib/server/providedLines', () => ({ getAvailableSources: vi.fn(async () => []) }));

import { db } from '@/lib/db';
import { getBoard } from '@/lib/server/players';
import { getDailyLeans } from './social';

/** 32 teams, 4 players each, ranked league-wide — an NFL-shaped player pool. */
const TEAMS = Array.from({ length: 32 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`);

function leagueBoard(): BoardRow[] {
  const rows: BoardRow[] = [];
  // Interleave by player index so team strength is spread through the ranking
  // rather than one team owning the top — the realistic case.
  for (let p = 0; p < 4; p++) {
    for (const team of TEAMS) {
      rows.push({
        rank: rows.length + 1,
        player: {
          sport: 'nfl',
          externalId: rows.length + 1,
          slug: `${team.toLowerCase()}-p${p}`,
          firstName: team,
          lastName: `Player${p}`,
          fullName: `${team} Player${p}`,
          position: 'WR',
          posBucket: 'WR',
          jersey: null,
          height: null,
          weight: null,
          teamAbbreviation: team,
          teamName: team,
          teamExternalId: null,
          gamesPlayed: 18,
        },
        stat: 'recYds',
        statShort: 'REC YDS',
        line: 64.5,
        projection: 71,
        fireScore: {
          side: 'over',
          score: 62,
          tier: 'Lean',
          trustFactor: 1,
          components: [],
          valueMode: false,
          note: '',
        },
      });
    }
  }
  return rows;
}

/**
 * Stands in for the real getBoard: rank league-wide, narrow to `teams` when the
 * caller asks for them, THEN apply the cap — which is the whole point. Without
 * `teams` the cap lands on the league's top rows, exactly as production did.
 */
function fakeGetBoard(_sport: unknown, opts: { limit?: number; teams?: readonly string[] } = {}) {
  const all = leagueBoard();
  const scoped = opts.teams
    ? all.filter((r) => opts.teams!.includes(r.player.teamAbbreviation!))
    : all;
  return Promise.resolve(scoped.slice(0, opts.limit ?? 40));
}

/** A Thursday-night slate: one game, two teams, kicking off two hours from now. */
function thursdayNight(now: Date, home: string, away: string) {
  vi.mocked(db.scheduledGame.findMany).mockResolvedValue([
    {
      startTime: new Date(now.getTime() + 2 * 3_600_000),
      homeTeam: { abbreviation: home },
      awayTeam: { abbreviation: away },
    },
  ] as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBoard).mockImplementation(fakeGetBoard as never);
  vi.mocked(db.team.findMany).mockResolvedValue([] as never);
});

describe('getDailyLeans on a light slate', () => {
  // 6:15pm ET on a Thursday in the NFL season.
  const now = new Date('2026-09-17T22:15:00Z');

  it('fills the card from the two teams actually playing', async () => {
    // T20/T21 sit mid-pack league-wide, so a league-wide top-40 would miss them.
    thursdayNight(now, 'T20', 'T21');
    const leans = await getDailyLeans('nfl', 5, now);

    expect(leans).toHaveLength(5);
    for (const lean of leans) {
      expect(['T20', 'T21']).toContain(lean.teamAbbreviation);
    }
  });

  it('asks the board for the slate teams instead of filtering afterwards', async () => {
    thursdayNight(now, 'T20', 'T21');
    await getDailyLeans('nfl', 5, now);

    expect(getBoard).toHaveBeenCalledWith(
      'nfl',
      expect.objectContaining({ teams: expect.arrayContaining(['T20', 'T21']) }),
    );
  });

  it('starves the card if the board is capped league-wide first', async () => {
    // The old behaviour, reproduced: cap to 40 league-wide, filter by team after.
    // Two teams out of 32 keep 2 of those 40 rows — not enough to fill a 5-lean
    // card, and once the Lean-tier filter takes its cut it is routinely zero.
    // (This fixture is generous: every row is Lean tier and each team has a row
    // inside the top 32. A real board has neither, which is why NFL Thursdays
    // and Mondays posted nothing at all.)
    thursdayNight(now, 'T20', 'T21');
    const leagueWideFirst = (await fakeGetBoard('nfl', { limit: 40 })).filter((r) =>
      ['T20', 'T21'].includes(r.player.teamAbbreviation!),
    );
    expect(leagueWideFirst).toHaveLength(2);

    // Scoped to the slate, the same board fills the card.
    const scoped = await getDailyLeans('nfl', 5, now);
    expect(scoped.length).toBeGreaterThan(leagueWideFirst.length);
    expect(scoped).toHaveLength(5);
  });

  it('still posts the league leaders when the whole league is playing', async () => {
    vi.mocked(db.scheduledGame.findMany).mockResolvedValue(
      TEAMS.map((t, i) => ({
        startTime: new Date(now.getTime() + 2 * 3_600_000),
        homeTeam: { abbreviation: t },
        awayTeam: { abbreviation: TEAMS[(i + 1) % TEAMS.length] },
      })) as never,
    );
    const leans = await getDailyLeans('nfl', 5, now);
    expect(leans).toHaveLength(5);
    expect(leans[0].teamAbbreviation).toBe('T01');
  });

  it('falls back to a league-wide board when the feed gives no usable abbreviations', async () => {
    vi.mocked(db.scheduledGame.findMany).mockResolvedValue([
      {
        startTime: new Date(now.getTime() + 2 * 3_600_000),
        homeTeam: { abbreviation: null },
        awayTeam: { abbreviation: null },
      },
    ] as never);
    await getDailyLeans('nfl', 5, now);
    expect(getBoard).toHaveBeenCalledWith('nfl', expect.objectContaining({ teams: undefined }));
  });
});
