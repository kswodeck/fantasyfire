import { describe, it, expect } from 'vitest';
import {
  computeFireFactor,
  FIREFACTOR_HIT_SPAN,
  type FireFactorInput,
  type WindowHits,
} from './fireScore';
import { wilsonInterval } from './confidence';

function win(overs: number, decided: number, window = '10'): WindowHits {
  return { window, overs, decided };
}

const base: FireFactorInput = {
  line: 20,
  windows: [win(7, 10, '5'), win(14, 20, '10'), win(27, 40, '20'), win(40, 62, 'season')],
  projection: 22,
  stdev: 5,
  cv: 0.25,
  matchup: 'B',
  gamesPlayed: 62,
};

describe('computeFireFactor', () => {
  it('leans over with a strong, well-sampled over history and gives a real tier', () => {
    const r = computeFireFactor(base);
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
    const scenarios: FireFactorInput[] = [
      base,
      { ...base, windows: [win(2, 10), win(5, 20), win(10, 40), win(16, 62)], projection: 16 },
      { ...base, windows: [win(3, 4)], gamesPlayed: 4 },
      { ...base, evPerDollar: { over: 0.2 } },
      { ...base, projection: null, stdev: null, matchup: undefined },
    ];
    for (const s of scenarios) {
      const note = computeFireFactor(s).note;
      for (const re of BANNED) expect(note, `matched ${re}`).not.toMatch(re);
    }
  });

  it('discounts a thin, marginal streak vs a large solid sample (Wilson gate)', () => {
    // 4/5 (80% on 5 games) has a low Wilson lower bound, so both its trustFactor
    // and its score sit below a 45/50 (90% on 50 games) sample.
    const hot = computeFireFactor({ ...base, windows: [win(4, 5, '5')], gamesPlayed: 5 });
    const big = computeFireFactor({ ...base, windows: [win(45, 50, '10')], gamesPlayed: 50 });
    expect(big.trustFactor).toBeGreaterThan(hot.trustFactor);
    expect(big.score).toBeGreaterThan(hot.score);
  });

  it('Passes only when there are no decided games at the line', () => {
    const r = computeFireFactor({ ...base, windows: [win(0, 0, '5')], gamesPlayed: 0 });
    expect(r.tier).toBe('Pass');
    expect(r.note).toMatch(/no read/i);
  });

  it('still grades a thin but strong sample (harder, not thrown out)', () => {
    const r = computeFireFactor({ ...base, windows: [win(4, 4, '5')], gamesPlayed: 4 });
    expect(r.tier).not.toBe('Pass'); // a clean 4/4 lean can still reach a read
    expect(r.note).toMatch(/small sample/i);
  });

  it('a thin AND weak sample still passes via the score floor', () => {
    const r = computeFireFactor({
      line: 20,
      windows: [win(2, 4, '5')],
      projection: 20,
      stdev: 5,
      cv: 0.6,
      matchup: undefined,
      gamesPlayed: 4,
    });
    expect(r.tier).toBe('Pass'); // ~coin flip on a tiny sample → score below the floor
  });

  it('degrades gracefully when projection + matchup are missing', () => {
    const r = computeFireFactor({ ...base, projection: null, stdev: null, matchup: undefined });
    const keys = r.components.map((c) => c.key);
    expect(keys).toContain('hit');
    expect(keys).not.toContain('proj');
    expect(keys).not.toContain('matchup');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('leans under when history is mostly under the line', () => {
    const r = computeFireFactor({
      ...base,
      windows: [win(2, 10, '5'), win(5, 20, '10'), win(10, 40, '20'), win(16, 62, 'season')],
      projection: 16,
    });
    expect(r.side).toBe('under');
  });

  it('VALUE mode lifts the score and flags valueMode when a price gives positive EV', () => {
    const lean = computeFireFactor(base);
    const value = computeFireFactor({ ...base, evPerDollar: { over: 0.2 } });
    expect(value.valueMode).toBe(true);
    expect(value.components.some((c) => c.key === 'value')).toBe(true);
    expect(value.score).toBeGreaterThanOrEqual(lean.score);
  });

  it('a positive cross-book line edge boosts the score; a worse number does not penalize', () => {
    const baseRead = computeFireFactor(base);
    const better = computeFireFactor({ ...base, lineValueEdge: 0.2 });
    const worse = computeFireFactor({ ...base, lineValueEdge: -0.2 });
    expect(better.components.some((c) => c.key === 'lineValue')).toBe(true);
    expect(better.score).toBeGreaterThan(baseRead.score);
    expect(worse.score).toBe(baseRead.score);
  });

  it('uses the model P(over) for the projection component when supplied', () => {
    const withModel = computeFireFactor({ ...base, modelProbOver: 0.7 });
    const proj = withModel.components.find((c) => c.key === 'proj')!;
    expect(proj.label).toBe('Projection vs line');
    // side is over, so the proj sub-score should equal the supplied P(over).
    expect(proj.score).toBeCloseTo(0.7, 9);
  });

  it('falls back to the z-score projection component when no model prob is given', () => {
    const r = computeFireFactor(base); // projection 22 vs line 20, stdev 5
    const proj = r.components.find((c) => c.key === 'proj')!;
    expect(proj.score).toBeGreaterThan(0.5); // projection above the line ⇒ leans over
  });

  it('hit sub-score uses the Wilson CENTER vs 0.5 (not the lower bound)', () => {
    const overs = 70;
    const decided = 100;
    const r = computeFireFactor({ ...base, windows: [win(overs, decided, 'season')], gamesPlayed: decided });
    const center = wilsonInterval(overs, decided).center;
    const hit = r.components.find((c) => c.key === 'hit')!.score;
    expect(hit).toBeCloseTo(Math.max(0, Math.min(1, (center - 0.5) / FIREFACTOR_HIT_SPAN)), 5);
  });

  it('a ~50/50 history gives a near-zero hit sub-score and no real lean', () => {
    const r = computeFireFactor({
      line: 20,
      windows: [win(50, 100, 'season')],
      projection: 20,
      stdev: 5,
      cv: 0.7,
      matchup: undefined,
      gamesPlayed: 100,
    });
    const hit = r.components.find((c) => c.key === 'hit')!.score;
    expect(hit).toBeLessThan(0.1);
    expect(['No lean', 'Pass']).toContain(r.tier);
  });

  it('a strong, well-sampled over maps to Strong lean under the current cutoffs', () => {
    const r = computeFireFactor({
      line: 20,
      windows: [win(72, 100, '5'), win(72, 100, '10'), win(72, 100, '20'), win(72, 100, 'season')],
      projection: 26,
      stdev: 4,
      cv: 0.2,
      matchup: 'A',
      gamesPlayed: 100,
    });
    expect(r.side).toBe('over');
    expect(r.tier).toBe('Strong lean');
  });
});
