import { describe, it, expect } from 'vitest';
import { pickDiverse, structurallyOneSidedStats } from './recap';
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

describe('structurallyOneSidedStats', () => {
  it('flags a stat that clears the bar almost entirely on one side', () => {
    // The reported bug: 96 MLB "hits" reads, all under — no achievable book-style
    // line splits this stat anywhere near 50/50, so it's a leaguewide shape, not
    // a differentiated read.
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({ stat: 'hits', side: 'under', player: { fullName: `H${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' } }),
    );
    expect(structurallyOneSidedStats(rows)).toEqual(new Set(['hits']));
  });

  it('keeps a stat whose over/under split is genuinely mixed', () => {
    const overs = Array.from({ length: 10 }, (_, i) =>
      row({ stat: 'ast', side: 'over', player: { fullName: `O${i}`, slug: `o${i}`, teamAbbreviation: 'NY' } }),
    );
    const unders = Array.from({ length: 9 }, (_, i) =>
      row({ stat: 'ast', side: 'under', player: { fullName: `U${i}`, slug: `u${i}`, teamAbbreviation: 'NY' } }),
    );
    expect(structurallyOneSidedStats([...overs, ...unders])).toEqual(new Set());
  });

  it('ignores a thin sample even if it happens to be all one side', () => {
    // Only 5 reads (below ONE_SIDED_MIN_SAMPLE) — too little to judge the stat's
    // shape, so it shouldn't get excluded off a small early-season sample.
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({ stat: 'hr', side: 'under', player: { fullName: `H${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' } }),
    );
    expect(structurallyOneSidedStats(rows)).toEqual(new Set());
  });

  it('judges each stat independently', () => {
    const oneSided = Array.from({ length: 20 }, (_, i) =>
      row({ stat: 'hits', side: 'under', player: { fullName: `H${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' } }),
    );
    const mixed = [
      ...Array.from({ length: 10 }, (_, i) => row({ stat: 'tb', side: 'over', player: { fullName: `O${i}`, slug: `to${i}`, teamAbbreviation: 'ATL' } })),
      ...Array.from({ length: 10 }, (_, i) => row({ stat: 'tb', side: 'under', player: { fullName: `U${i}`, slug: `tu${i}`, teamAbbreviation: 'ATL' } })),
    ];
    expect(structurallyOneSidedStats([...oneSided, ...mixed])).toEqual(new Set(['hits']));
  });
});

describe('one-sided de-prioritization (structurallyOneSidedStats + pickDiverse)', () => {
  it('caps a one-sided stat instead of zeroing it out when it is the only signal available', () => {
    // MLB's real shape locally: hits/tb were the ONLY two stats that ever settled,
    // both 100% under. A hard exclude would leave MLB with zero rows; the
    // composition below (what getYesterdayRecap/getAllSportsAccuracy actually do)
    // should cap them instead — asserted here at a limit that matches the cap
    // exactly, so pickDiverse's "still fill the page" backfill (covered by its
    // own tests above) doesn't mask what the cap by itself does.
    const mlbRows = [
      ...Array.from({ length: 9 }, (_, i) =>
        row({ sport: 'mlb', stat: 'hits', side: 'under', score: 90 - i, player: { fullName: `H${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' } }),
      ),
    ].sort((a, b) => b.score - a.score);

    const oneSided = structurallyOneSidedStats(mlbRows);
    expect(oneSided).toEqual(new Set(['hits']));

    const picked = pickDiverse(mlbRows, 3, [
      {
        key: (r) => (oneSided.has(r.stat) ? 'one-sided' : `exempt:${r.player.slug}:${r.stat}`),
        max: 3,
      },
    ]);

    // Capped, not zeroed: MLB still shows content instead of disappearing entirely.
    expect(picked).toHaveLength(3);
    expect(picked.every((r) => r.stat === 'hits')).toBe(true);
  });

  it('lets a genuinely differentiated stat outrank one-sided rows for the limited slots', () => {
    const oneSidedRows = Array.from({ length: 9 }, (_, i) =>
      row({ sport: 'mlb', stat: 'hits', side: 'under', score: 70 - i, player: { fullName: `H${i}`, slug: `h${i}`, teamAbbreviation: 'ATL' } }),
    );
    const differentiated = [
      row({ sport: 'mlb', stat: 'hitterFs', side: 'over', score: 55, player: { fullName: 'Star', slug: 'star', teamAbbreviation: 'ATL' } }),
    ];
    const allRows = [...oneSidedRows, ...differentiated].sort((a, b) => b.score - a.score);

    const oneSided = structurallyOneSidedStats(allRows);
    expect(oneSided).toEqual(new Set(['hits']));

    const picked = pickDiverse(allRows, 4, [
      {
        key: (r) => (oneSided.has(r.stat) ? 'one-sided' : `exempt:${r.player.slug}:${r.stat}`),
        max: 3,
      },
    ]);

    expect(picked).toHaveLength(4);
    // The differentiated read makes it in even though it scores below several
    // one-sided rows, because only 3 of those may fill the 4 slots.
    expect(picked.some((r) => r.stat === 'hitterFs')).toBe(true);
    expect(picked.filter((r) => r.stat === 'hits')).toHaveLength(3);
  });
});
