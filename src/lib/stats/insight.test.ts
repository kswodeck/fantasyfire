import { describe, it, expect } from 'vitest';
import { buildWhyText } from './insight';
import { computeHitRate, type GameStatLine } from './index';
import type { DvpCell } from './dvp';

function ptsGames(values: number[]): GameStatLine[] {
  return values.map((points) => ({
    points,
    rebounds: 0,
    oreb: 0,
    dreb: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    minutes: 30,
  }));
}

describe('buildWhyText', () => {
  const games = ptsGames([30, 28, 26, 22, 31, 18, 27, 24, 29, 20, 25, 26]);
  const recent = computeHitRate(games, 'pts', 24.5, 10);
  const season = computeHitRate(games, 'pts', 24.5, 'season');

  it('mentions recent form, matchup, volatility, and a hedge', () => {
    const dvpCell: DvpCell = {
      opponentTeamId: 5,
      posBucket: 'G',
      stat: 'pts',
      avgAllowed: 28.4,
      sampleSize: 40,
      rank: 2,
      totalRanked: 30,
      lowSample: false,
    };
    const text = buildWhyText({
      playerName: 'Test Player',
      stat: 'pts',
      line: 24.5,
      recent,
      season,
      dvp: { cell: dvpCell, opponentAbbreviation: 'LAL' },
    });

    expect(text).toContain('Test Player');
    expect(text).toContain('last 10 games');
    expect(text).toContain('LAL');
    expect(text).toContain('2nd-most');
    expect(text).toContain('favorable'); // rank 2/30 -> favorable
    expect(text).toMatch(/not predictions/i);
  });

  it('handles a missing DvP matchup gracefully', () => {
    const text = buildWhyText({
      playerName: 'Test Player',
      stat: 'pts',
      line: 24.5,
      recent,
      season,
      dvp: null,
    });
    expect(text).toContain('Test Player');
    expect(text).not.toContain('matchup for');
  });

  it('flags low-sample DvP cells', () => {
    const dvpCell: DvpCell = {
      opponentTeamId: 5,
      posBucket: 'C',
      stat: 'pts',
      avgAllowed: 30,
      sampleSize: 4,
      rank: 1,
      totalRanked: 30,
      lowSample: true,
    };
    const text = buildWhyText({
      playerName: 'Big Man',
      stat: 'pts',
      line: 20,
      recent,
      season,
      dvp: { cell: dvpCell, opponentAbbreviation: 'BOS' },
    });
    expect(text).toMatch(/small sample/i);
  });
});
