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

// The descriptive-never-predictive tone is the product's brand and its FTC
// safety net. Lock it with a guardrail: no matter the inputs, the readout must
// not emit promissory / hype language. (Carefully avoids "predictions", which the
// honest hedge legitimately uses in "not predictions or betting advice".)
describe('buildWhyText guardrail — never promissory or hype', () => {
  const BANNED: RegExp[] = [
    /\bguarantee/i, // guarantee, guaranteed
    /\block\b/i, // a "lock"
    /\bsure thing\b/i,
    /\bcan'?t miss\b/i,
    /\bwill (hit|smash|cash|go over|go under)\b/i,
    /\b(easy|free) money\b/i,
    /\bwe predict\b/i,
    /\bsmash\b/i,
  ];

  function cell(rank: number, sampleSize: number): DvpCell {
    return {
      opponentTeamId: 5,
      posBucket: 'G',
      stat: 'pts',
      avgAllowed: 25,
      sampleSize,
      rank,
      totalRanked: 30,
      lowSample: sampleSize < 10,
    };
  }

  const hot = ptsGames([40, 38, 41, 39, 37, 42, 40, 39, 41, 38]);
  const cold = ptsGames([5, 4, 6, 3, 7, 2, 5, 4, 6, 3]);
  const mixed = ptsGames([30, 28, 26, 22, 31, 18, 27, 24, 29, 20, 25, 26]);

  const scenarios = [
    { games: hot, line: 20, dvp: cell(1, 60) }, // hot streak, softest matchup
    { games: cold, line: 20, dvp: cell(30, 60) }, // cold streak, toughest matchup
    { games: mixed, line: 24.5, dvp: cell(15, 60) }, // middling
    { games: mixed, line: 24.5, dvp: cell(2, 4) }, // low-sample cell
    { games: mixed, line: 24.5, dvp: null }, // no matchup
    { games: [] as GameStatLine[], line: 24.5, dvp: null }, // no decided games
  ];

  it('emits no promissory/hype language and always carries the hedge', () => {
    for (const s of scenarios) {
      const r = computeHitRate(s.games, 'pts', s.line, 10);
      const seas = computeHitRate(s.games, 'pts', s.line, 'season');
      const text = buildWhyText({
        playerName: 'Test Player',
        stat: 'pts',
        line: s.line,
        recent: r,
        season: seas,
        dvp: s.dvp ? { cell: s.dvp, opponentAbbreviation: 'LAL' } : null,
      });
      for (const pattern of BANNED) {
        expect(text, `line ${s.line} matched ${pattern}`).not.toMatch(pattern);
      }
      expect(text).toMatch(/not predictions or betting advice/i);
    }
  });
});
