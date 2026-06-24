import { describe, it, expect } from 'vitest';
import { parseEspnAthlete } from './espn';

const NAMES = [
  'MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-',
];

describe('parseEspnAthlete', () => {
  it('parses a full stat line (made-attempted split, signed +/-)', () => {
    // Jaren Jackson Jr.: 33 MIN, 30 PTS, 12-22 FG, 3-5 3PT, 3-3 FT, ...
    const stats = ['33', '30', '12-22', '3-5', '3-3', '3', '1', '4', '2', '2', '0', '3', '3', '-21'];
    expect(parseEspnAthlete(NAMES, stats)).toEqual({
      minutes: 33,
      pts: 30,
      fgm: 12,
      fga: 22,
      fg3m: 3,
      fg3a: 5,
      ftm: 3,
      fta: 3,
      reb: 3,
      ast: 1,
      tov: 4,
      stl: 2,
      blk: 2,
      oreb: 0,
      dreb: 3,
      pf: 3,
      plusMinus: -21,
    });
  });

  it('handles a positive +/- and zeros', () => {
    const stats = ['12', '0', '0-3', '0-1', '0-0', '5', '2', '1', '0', '1', '2', '3', '4', '+8'];
    const r = parseEspnAthlete(NAMES, stats);
    expect(r.pts).toBe(0);
    expect(r.fga).toBe(3);
    expect(r.plusMinus).toBe(8);
  });

  it('tolerates a missing/empty +/- and minutes (DNP-ish edge)', () => {
    const stats = ['', '', '0-0', '0-0', '0-0', '', '', '', '', '', '', '', '', ''];
    const r = parseEspnAthlete(NAMES, stats);
    expect(r.minutes).toBeNull();
    expect(r.plusMinus).toBeNull();
    expect(r.pts).toBe(0);
  });
});
