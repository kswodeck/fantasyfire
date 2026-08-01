import { describe, it, expect } from 'vitest';
import {
  correlationWarning,
  hasCorrelation,
  correlatedLegKeys,
  type CorrelatableLeg,
} from './correlation';

const leg = (slug: string, gameId: string | null, sport = 'mlb'): CorrelatableLeg => ({
  slug,
  sport,
  gameId,
});

describe('correlationWarning', () => {
  it('finds nothing in an entry of independent legs', () => {
    const w = correlationWarning([leg('judge', 'g1'), leg('betts', 'g2'), leg('soto', 'g3')]);
    expect(hasCorrelation(w)).toBe(false);
  });

  it('flags two legs on the same player', () => {
    const w = correlationWarning([leg('judge', 'g1'), leg('judge', 'g1'), leg('betts', 'g2')]);
    expect(w.samePlayer).toHaveLength(1);
    expect(w.samePlayer[0].legs).toHaveLength(2);
    // Not ALSO reported as a same-game group — it's one problem, not two.
    expect(w.sameGame).toHaveLength(0);
  });

  it('flags two different players in the same game', () => {
    const w = correlationWarning([leg('judge', 'g1'), leg('soto', 'g1'), leg('betts', 'g2')]);
    expect(w.sameGame).toHaveLength(1);
    expect(w.sameGame[0].legs.map((l) => l.slug)).toEqual(['judge', 'soto']);
    expect(w.samePlayer).toHaveLength(0);
  });

  it('reports both when an entry stacks a player AND a teammate', () => {
    const w = correlationWarning([leg('judge', 'g1'), leg('judge', 'g1'), leg('soto', 'g1')]);
    expect(w.samePlayer).toHaveLength(1);
    expect(w.sameGame).toHaveLength(1); // judge ×2 + soto → >1 distinct slug
    expect(hasCorrelation(w)).toBe(true);
  });

  it('never groups legs with an unknown game', () => {
    // Two nulls must not be treated as "the same game".
    const w = correlationWarning([leg('judge', null), leg('soto', null)]);
    expect(w.sameGame).toHaveLength(0);
    expect(hasCorrelation(w)).toBe(false);
  });

  it('does not group the same game id across different sports', () => {
    const w = correlationWarning([leg('judge', 'g1', 'mlb'), leg('wilson', 'g1', 'wnba')]);
    expect(w.sameGame).toHaveLength(0);
  });

  it('collects every affected leg key for inline marking', () => {
    const legs = [leg('judge', 'g1'), leg('soto', 'g1'), leg('betts', 'g2')];
    const keys = correlatedLegKeys(correlationWarning(legs), (l) => l.slug);
    expect([...keys].sort()).toEqual(['judge', 'soto']);
  });
});
