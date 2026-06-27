import { describe, it, expect } from 'vitest';
import {
  computeFireFactor,
  fireFactorFromProb,
  gateAvailability,
  AVAILABILITY_DISCOUNT,
  FIREFACTOR_HIT_SPAN,
  FIREFACTOR_TIER_CUTOFFS,
  FIREFACTOR_CURVE,
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

  it('hit sub-score is 0.5-centered on the Wilson CENTER (50% rate ⇒ neutral)', () => {
    const overs = 58; // ~58% rate — chosen so the sub-score does NOT clamp to 1.0
    const decided = 100;
    const r = computeFireFactor({ ...base, windows: [win(overs, decided, 'season')], gamesPlayed: decided });
    const center = wilsonInterval(overs, decided).center;
    const hit = r.components.find((c) => c.key === 'hit')!.score;
    expect(hit).toBeCloseTo(
      Math.max(0, Math.min(1, 0.5 + (center - 0.5) / (2 * FIREFACTOR_HIT_SPAN))),
      5,
    );
    expect(hit).toBeGreaterThan(0.5); // a real over-lean reads above neutral
  });

  it('a ~50/50 history gives a NEUTRAL hit sub-score and no real lean', () => {
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
    expect(hit).toBeCloseTo(0.5, 1); // a coin-flip rate is neutral, not bearish
    expect(['No lean', 'Pass']).toContain(r.tier);
    expect(r.score).toBeLessThan(FIREFACTOR_TIER_CUTOFFS.slight); // no read on a coin flip
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

describe('gateAvailability', () => {
  const baseInput: FireFactorInput = {
    line: 20,
    windows: [win(72, 100, '5'), win(72, 100, '10'), win(72, 100, '20'), win(72, 100, 'season')],
    projection: 26,
    stdev: 4,
    cv: 0.2,
    matchup: 'A',
    gamesPlayed: 100,
  };
  const base = computeFireFactor(baseInput);

  it('is a no-op for a clear (null) status', () => {
    expect(gateAvailability(base, null)).toEqual(base);
  });

  it('forces a no-read when the player is Out', () => {
    const g = gateAvailability(base, 'out');
    expect(g.score).toBe(0);
    expect(g.tier).toBe('Pass');
    expect(g.note).toMatch(/out/i);
  });

  it('discounts the score for game-time tiers and re-tiers', () => {
    const q = gateAvailability(base, 'questionable');
    expect(q.score).toBe(Math.round(base.score * AVAILABILITY_DISCOUNT.questionable));
    expect(q.score).toBeLessThan(base.score);
    expect(q.note).toMatch(/confirm status/i);
    // doubtful discounts harder than day-to-day
    const d = gateAvailability(base, 'doubtful');
    const dtd = gateAvailability(base, 'day-to-day');
    expect(d.score).toBeLessThan(dtd.score);
  });

  it('keeps an already-unreadable Pass as Pass', () => {
    const pass = computeFireFactor({ ...baseInput, windows: [win(0, 0, '5')], gamesPlayed: 0 });
    expect(pass.tier).toBe('Pass');
    expect(gateAvailability(pass, 'questionable').tier).toBe('Pass');
  });
});

describe('fireFactorFromProb (concave probability curve)', () => {
  it('a coin flip (or worse) maps to 0', () => {
    expect(fireFactorFromProb(0.5)).toBe(0);
    expect(fireFactorFromProb(0.42)).toBe(0);
  });
  it('hits exactly the anchor points', () => {
    for (const [p, ff] of FIREFACTOR_CURVE) {
      expect(fireFactorFromProb(p)).toBeCloseTo(ff, 6);
    }
  });
  it('is monotonic increasing', () => {
    let prev = -1;
    for (let p = 0.5; p <= 0.95; p += 0.01) {
      const ff = fireFactorFromProb(p);
      expect(ff).toBeGreaterThanOrEqual(prev);
      prev = ff;
    }
  });
  it('is concave — a small edge moves more than an equal edge near the top', () => {
    const low = fireFactorFromProb(0.6) - fireFactorFromProb(0.55); // +5pp at the bottom
    const high = fireFactorFromProb(0.9) - fireFactorFromProb(0.85); // +5pp near the top
    expect(low).toBeGreaterThan(high);
  });
  it('only a near-certain read tops out at 100', () => {
    expect(fireFactorFromProb(0.92)).toBe(100);
    expect(fireFactorFromProb(0.8)).toBeLessThan(90); // a strong-but-not-certain read
  });
});
