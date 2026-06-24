import { describe, it, expect } from 'vitest';
import { computeDvp, dvpLookup, isLowSample, type DvpInputRow } from './dvp';
import { type GameStatLine, type PosBucket } from './types';

function row(opponentTeamId: number, posBucket: PosBucket | null, points: number): DvpInputRow {
  const game: GameStatLine = {
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
  };
  return { opponentTeamId, posBucket, game };
}

describe('computeDvp', () => {
  it('averages per (team, bucket) and ranks 1 = allows the most', () => {
    const rows = [
      row(1, 'G', 20),
      row(1, 'G', 30), // team 1 G avg = 25
      row(2, 'G', 10),
      row(2, 'G', 10), // team 2 G avg = 10
      row(3, 'G', 40), // team 3 G avg = 40
    ];
    const cells = computeDvp(rows, 'pts');

    const t3 = dvpLookup(cells, 3, 'G', 'pts')!;
    const t1 = dvpLookup(cells, 1, 'G', 'pts')!;
    const t2 = dvpLookup(cells, 2, 'G', 'pts')!;

    expect(t3.avgAllowed).toBe(40);
    expect(t3.rank).toBe(1); // allows the most
    expect(t3.sampleSize).toBe(1);
    expect(t3.totalRanked).toBe(3);

    expect(t1.avgAllowed).toBe(25);
    expect(t1.rank).toBe(2);
    expect(t1.sampleSize).toBe(2);

    expect(t2.avgAllowed).toBe(10);
    expect(t2.rank).toBe(3);
  });

  it('uses competition ranking for ties (equal averages share a rank)', () => {
    const rows = [row(1, 'F', 20), row(2, 'F', 20), row(3, 'F', 30)];
    const cells = computeDvp(rows, 'pts');
    expect(dvpLookup(cells, 3, 'F', 'pts')!.rank).toBe(1);
    expect(dvpLookup(cells, 1, 'F', 'pts')!.rank).toBe(2);
    expect(dvpLookup(cells, 2, 'F', 'pts')!.rank).toBe(2); // tie shares rank 2
  });

  it('ignores rows with a null posBucket', () => {
    const rows = [row(1, null, 100), row(1, 'C', 10)];
    const cells = computeDvp(rows, 'pts');
    const c = dvpLookup(cells, 1, 'C', 'pts')!;
    expect(c.avgAllowed).toBe(10); // the null-bucket 100 is excluded
    expect(c.sampleSize).toBe(1);
    // No cell created from the null row.
    expect(cells.length).toBe(1);
  });

  it('ranks buckets independently', () => {
    const rows = [
      row(1, 'G', 10),
      row(2, 'G', 20),
      row(1, 'C', 30),
      row(2, 'C', 5),
    ];
    const cells = computeDvp(rows, 'pts');
    expect(dvpLookup(cells, 2, 'G', 'pts')!.rank).toBe(1);
    expect(dvpLookup(cells, 1, 'C', 'pts')!.rank).toBe(1);
  });

  it('flags low-sample cells', () => {
    expect(isLowSample(9)).toBe(true);
    expect(isLowSample(10)).toBe(false);
    const cells = computeDvp([row(1, 'G', 10)], 'pts');
    expect(cells[0].lowSample).toBe(true);
  });
});
