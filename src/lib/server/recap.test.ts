import { describe, it, expect } from 'vitest';
import { pickDiverse } from './recap';
import type { RecapRow } from '@/lib/types';

function row(partial: Partial<RecapRow>): RecapRow {
  return {
    sport: 'nba',
    player: { fullName: 'Test Player', slug: 'test-player', teamAbbreviation: 'AAA' },
    stat: 'pts',
    statShort: 'PTS',
    line: 24.5,
    side: 'over',
    score: 60,
    tier: 'Lean',
    actual: 27,
    result: 'hit',
    ...partial,
  };
}

describe('pickDiverse', () => {
  it('caps how many rows can share a group key, backfilling from the rest by score', () => {
    // 10 identical "under 1.5 hits" rows (the reported bug) — a plain top-N sort
    // would fill the whole list with this one combo.
    const monoculture = Array.from({ length: 10 }, (_, i) =>
      row({ player: { fullName: `Hitter ${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' }, stat: 'hits', side: 'under', score: 90 - i }),
    );
    const varied = [
      row({ player: { fullName: 'Rebounder', slug: 'reb', teamAbbreviation: 'BOS' }, stat: 'reb', side: 'over', score: 70 }),
      row({ player: { fullName: 'Assister', slug: 'ast', teamAbbreviation: 'LAL' }, stat: 'ast', side: 'over', score: 65 }),
      row({ player: { fullName: 'Blocker', slug: 'blk', teamAbbreviation: 'MIA' }, stat: 'blk', side: 'over', score: 60 }),
    ];
    const rows = [...monoculture, ...varied].sort((a, b) => b.score - a.score);

    // Exactly enough room for the 2-per-combo cap plus all 3 varied rows — no
    // backfill needed, so this isolates the cap's behavior from the fallback.
    const picked = pickDiverse(rows, 5, [{ key: (r) => `${r.stat}:${r.side}`, max: 2 }]);

    expect(picked).toHaveLength(5);
    const hitsUnderCount = picked.filter((r) => r.stat === 'hits' && r.side === 'under').length;
    expect(hitsUnderCount).toBe(2);
    // The varied rows should have made it in ahead of lower-scored monoculture rows.
    expect(picked.some((r) => r.stat === 'reb')).toBe(true);
    expect(picked.some((r) => r.stat === 'ast')).toBe(true);
    expect(picked.some((r) => r.stat === 'blk')).toBe(true);
  });

  it('backfills with over-cap rows when there is nothing else to fill the limit', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({ player: { fullName: `Hitter ${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' }, stat: 'hits', side: 'under', score: 90 - i }),
    );

    // A day that's genuinely one-note still returns a full list instead of coming up short.
    const picked = pickDiverse(rows, 5, [{ key: (r) => `${r.stat}:${r.side}`, max: 2 }]);

    expect(picked).toHaveLength(5);
    expect(picked.map((r) => r.player.slug)).toEqual(['h0', 'h1', 'h2', 'h3', 'h4']);
  });

  it('respects multiple simultaneous constraints (sport cap + stat/side cap)', () => {
    const mlbHits = Array.from({ length: 8 }, (_, i) =>
      row({
        sport: 'mlb',
        player: { fullName: `Hitter ${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' },
        stat: 'hits',
        side: 'under',
        score: 90 - i,
      }),
    );
    const wnba = [
      row({ sport: 'wnba', player: { fullName: 'Wing', slug: 'w1', teamAbbreviation: 'NY' }, stat: 'reb', side: 'over', score: 55 }),
      row({ sport: 'wnba', player: { fullName: 'Guard', slug: 'w2', teamAbbreviation: 'CHI' }, stat: 'ast', side: 'over', score: 50 }),
      row({ sport: 'wnba', player: { fullName: 'Center', slug: 'w3', teamAbbreviation: 'SEA' }, stat: 'blk', side: 'over', score: 45 }),
    ];
    const rows = [...mlbHits, ...wnba].sort((a, b) => b.score - a.score);

    const picked = pickDiverse(rows, 6, [
      { key: (r) => r.sport, max: 3 },
      { key: (r) => `${r.sport}:${r.stat}:${r.side}`, max: 2 },
    ]);

    expect(picked).toHaveLength(6);
    expect(picked.filter((r) => r.sport === 'mlb')).toHaveLength(3);
    expect(picked.filter((r) => r.sport === 'wnba')).toHaveLength(3);
  });

  it('is a no-op (aside from truncation) when nothing exceeds the caps', () => {
    const rows = [
      row({ stat: 'pts', side: 'over', score: 80 }),
      row({ stat: 'reb', side: 'under', score: 70 }),
      row({ stat: 'ast', side: 'over', score: 60 }),
    ];
    const picked = pickDiverse(rows, 10, [{ key: (r) => `${r.stat}:${r.side}`, max: 1 }]);
    expect(picked).toEqual(rows);
  });
});
