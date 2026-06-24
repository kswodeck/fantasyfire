import { describe, it, expect } from 'vitest';
import { computeFireScore, type FireScoreInput, type WindowHits } from './fireScore';

function win(overs: number, decided: number, window = '10'): WindowHits {
  return { window, overs, decided };
}

const base: FireScoreInput = {
  line: 20,
  windows: [win(7, 10, '5'), win(14, 20, '10'), win(27, 40, '20'), win(40, 62, 'season')],
  projection: 22,
  stdev: 5,
  cv: 0.25,
  matchup: 'B',
  gamesPlayed: 62,
};

describe('computeFireScore', () => {
  it('leans over with a strong, well-sampled over history and gives a real tier', () => {
    const r = computeFireScore(base);
    expect(r.side).toBe('over');
    expect(r.score).toBeGreaterThan(30);
    expect(['Strong lean', 'Lean', 'Slight lean']).toContain(r.tier);
    expect(r.components.some((c) => c.key === 'hit')).toBe(true);
    expect(r.note).toMatch(/not betting advice/i);
  });

  it('never emits promissory / tout language in the note (any scenario)', () => {
    const BANNED = [
      /\bguarantee/i,
      /\block(s)?\b/i,
      /\bsure thing\b/i,
      /\bwill (hit|cash|cover)\b/i,
      /\bbest bet\b/i,
      /\+ev\b/i,
      /\bpick\b/i,
      /\bwin probability\b/i,
    ];
    const scenarios: FireScoreInput[] = [
      base,
      { ...base, windows: [win(2, 10), win(5, 20), win(10, 40), win(16, 62)], projection: 16 },
      { ...base, windows: [win(3, 4)], gamesPlayed: 4 },
      { ...base, evPerDollar: { over: 0.2 } },
      { ...base, projection: null, stdev: null, matchup: undefined },
    ];
    for (const s of scenarios) {
      const note = computeFireScore(s).note;
      for (const re of BANNED) expect(note, `matched ${re}`).not.toMatch(re);
    }
  });

  it('discounts a thin, marginal streak vs a large solid sample (Wilson gate)', () => {
    // 4/5 (80% on 5 games) has a low Wilson lower bound, so both its trustFactor
    // and its score sit below a 45/50 (90% on 50 games) sample.
    const hot = computeFireScore({ ...base, windows: [win(4, 5, '5')], gamesPlayed: 5 });
    const big = computeFireScore({ ...base, windows: [win(45, 50, '10')], gamesPlayed: 50 });
    expect(big.trustFactor).toBeGreaterThan(hot.trustFactor);
    expect(big.score).toBeGreaterThan(hot.score);
  });

  it('Passes when there are too few games', () => {
    const r = computeFireScore({ ...base, windows: [win(3, 4, '5')], gamesPlayed: 4 });
    expect(r.tier).toBe('Pass');
    expect(r.note).toMatch(/Pass/i);
  });

  it('degrades gracefully when projection + matchup are missing', () => {
    const r = computeFireScore({ ...base, projection: null, stdev: null, matchup: undefined });
    const keys = r.components.map((c) => c.key);
    expect(keys).toContain('hit');
    expect(keys).not.toContain('proj');
    expect(keys).not.toContain('matchup');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('leans under when history is mostly under the line', () => {
    const r = computeFireScore({
      ...base,
      windows: [win(2, 10, '5'), win(5, 20, '10'), win(10, 40, '20'), win(16, 62, 'season')],
      projection: 16,
    });
    expect(r.side).toBe('under');
  });

  it('VALUE mode lifts the score and flags valueMode when a price gives positive EV', () => {
    const lean = computeFireScore(base);
    const value = computeFireScore({ ...base, evPerDollar: { over: 0.2 } });
    expect(value.valueMode).toBe(true);
    expect(value.components.some((c) => c.key === 'value')).toBe(true);
    expect(value.score).toBeGreaterThanOrEqual(lean.score);
  });
});
