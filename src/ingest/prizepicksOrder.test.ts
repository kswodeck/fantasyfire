import { describe, it, expect } from 'vitest';
import { leagueFetchOrder } from './prizepicks';

// PrizePicks throttles a run of requests from one IP: the first ~2 leagues land and
// later ones 429. Whoever sits at the front of the order is who reliably gets lines.
// The old order put NBA (preseason) first and NFL third, so through September NFL —
// mid-season — ate the 429s. League 9 failed outright at 09:40 UTC on 2026-09-26.

const PP = { nfl: 9, nba: 7, mlb: 2, nhl: 8, wnba: 3, mls: 82 } as const;

describe('leagueFetchOrder', () => {
  it('puts NFL first in late September, when NBA and NHL are still in preseason', () => {
    const order = leagueFetchOrder(new Date('2026-09-26T09:40:00Z'));
    expect(order[0]).toBe(PP.nfl);
    // The other live leagues next; the two preseason ones last.
    expect(order.slice(0, 4)).toEqual([PP.nfl, PP.mlb, PP.wnba, PP.mls]);
    expect(order.slice(4)).toEqual([PP.nba, PP.nhl]);
  });

  it('lets NBA and NHL move up once their seasons start', () => {
    const order = leagueFetchOrder(new Date('2026-12-01T12:00:00Z'));
    // December: NFL, NBA, NHL are live; MLB and WNBA are not.
    expect(order.slice(0, 3)).toEqual([PP.nfl, PP.nba, PP.nhl]);
    expect(order).toContain(PP.mlb);
    expect(order.indexOf(PP.mlb)).toBeGreaterThan(order.indexOf(PP.nhl));
  });

  it('drops NFL behind the live leagues in its own off-season', () => {
    const order = leagueFetchOrder(new Date('2026-06-10T12:00:00Z'));
    expect(order.at(-1)).toBe(PP.nfl);
  });

  it('never drops a league — order only, every id is still fetched', () => {
    for (const d of ['2026-01-15', '2026-04-15', '2026-07-15', '2026-09-26', '2026-11-15']) {
      expect([...leagueFetchOrder(new Date(`${d}T12:00:00Z`))].sort()).toEqual(
        Object.values(PP).sort(),
      );
    }
  });
});
