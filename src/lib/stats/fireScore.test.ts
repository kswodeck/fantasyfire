import { describe, it, expect } from 'vitest';
import {
  computeFireFactor,
  fireFactorFromProb,
  gateAvailability,
  AVAILABILITY_DISCOUNT,
  FIREFACTOR_HIT_SPAN,
  FIREFACTOR_TIER_CUTOFFS,
  FIREFACTOR_CHANCE_FLOOR,
  FIREFACTOR_CURVE,
  type FireFactorInput,
  type WindowHits,
} from './fireScore';

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
      // Over-only variant whose history runs under (the pinned-side note).
      {
        ...base,
        windows: [win(2, 10), win(5, 20), win(10, 40), win(16, 62)],
        projection: 16,
        overOnly: true,
      },
      // Breakeven-calibrated variant (the "scored against ~X% breakeven" note).
      {
        ...base,
        windows: [win(2, 10), win(5, 20), win(10, 40), win(16, 62)],
        projection: 16,
        overOnly: true,
        benchmark: 0.3,
      },
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

  it('overOnly pins the side to over even when history runs under, scoring the over weakly', () => {
    const underHistory = {
      ...base,
      windows: [win(2, 10, '5'), win(5, 20, '10'), win(10, 40, '20'), win(16, 62, 'season')],
      projection: 16,
    };
    const free = computeFireFactor(underHistory);
    const pinned = computeFireFactor({ ...underHistory, overOnly: true });
    expect(free.side).toBe('under');
    expect(pinned.side).toBe('over');
    // Scoring the weak side means a much lower read than the free under lean.
    expect(pinned.score).toBeLessThan(free.score);
    expect(pinned.note).toMatch(/only pays the over/i);
  });

  it('overOnly is a no-op when history already leans over', () => {
    const free = computeFireFactor(base);
    const pinned = computeFireFactor({ ...base, overOnly: true });
    expect(pinned.side).toBe('over');
    expect(pinned.score).toBe(free.score);
    expect(pinned.tier).toBe(free.tier);
  });

  describe('benchmark (payout-variant calibration)', () => {
    // A demon-shaped history: ~35-40% over rate on a healthy sample.
    const demonish: FireFactorInput = {
      line: 30,
      windows: [win(2, 5, '5'), win(4, 10, '10'), win(7, 20, '20'), win(14, 40, 'season')],
      projection: 28,
      stdev: 6,
      cv: 0.3,
      matchup: undefined,
      gamesPlayed: 40,
      overOnly: true,
    };

    it('a below-50% over history floors in single digits vs a coin flip but reads real value vs its breakeven', () => {
      const coinFlip = computeFireFactor(demonish);
      const value = computeFireFactor({ ...demonish, benchmark: 0.25 });
      // No edge over 50/50 — but a ~37% chance is far from impossible, so the
      // chance floor keeps it in the single digits instead of a flat 0.
      expect(coinFlip.score).toBeGreaterThan(0);
      expect(coinFlip.score).toBeLessThanOrEqual(FIREFACTOR_CHANCE_FLOOR.cap);
      expect(value.side).toBe('over');
      expect(value.score).toBeGreaterThan(coinFlip.score);
      expect(value.tier).not.toBe('Pass');
      expect(value.note).toMatch(/breakeven/i);
      expect(value.note).toMatch(/not betting advice/i);
    });

    it('a truly bad demon (≈10% chance vs a 35% breakeven) reads single digits, not a tier', () => {
      const r = computeFireFactor({
        ...demonish,
        windows: [win(1, 10, '5'), win(2, 20, '10'), win(4, 40, '20')],
        projection: 22,
        benchmark: 0.35,
      });
      expect(r.score).toBeGreaterThan(0); // still a real (if tiny) chance
      expect(r.score).toBeLessThanOrEqual(FIREFACTOR_CHANCE_FLOOR.cap);
      expect(r.tier).toBe('Pass'); // never manufactures a tier
    });

    it('the chance floor scales with P(hit) and 0 stays reserved for ~0% chances', () => {
      const never = computeFireFactor({
        ...demonish,
        windows: [win(0, 10, '5'), win(0, 20, '10'), win(0, 40, '20')],
        projection: 10,
        benchmark: 0.35,
      });
      // 0-for-40 with a far-off projection ≈ 0% chance (Wilson smoothing keeps a
      // sliver of doubt, so at most a 1).
      expect(never.score).toBeLessThanOrEqual(1);
      const likelyButBadValue = computeFireFactor({
        ...demonish,
        windows: [win(8, 10, '5'), win(15, 20, '10'), win(30, 40, '20')],
        benchmark: 0.95, // absurd breakeven → no value edge at all
      });
      expect(likelyButBadValue.score).toBeGreaterThan(0);
      expect(likelyButBadValue.score).toBeLessThanOrEqual(FIREFACTOR_CHANCE_FLOOR.cap);
    });

    it('an easier benchmark scores the same history higher', () => {
      const tight = computeFireFactor({ ...demonish, benchmark: 0.35 });
      const loose = computeFireFactor({ ...demonish, benchmark: 0.2 });
      expect(loose.score).toBeGreaterThan(tight.score);
    });

    it('scales the hit span with binomial noise at the benchmark (extreme edges count more)', () => {
      // Same raw sample; the variant benchmark's smaller √p(1−p) tightens the span,
      // so a +10pt edge over a 0.75 bar out-scores the same points over 0.5.
      const windows = [win(17, 20, '10'), win(34, 40, '20')]; // 85% rate
      const vsGoblinBar = computeFireFactor({
        ...base,
        windows,
        matchup: undefined,
        overOnly: true,
        benchmark: 0.75,
      });
      const hit = (r: ReturnType<typeof computeFireFactor>) =>
        r.components.find((c) => c.key === 'hit')!.score;
      const expectedSpan = FIREFACTOR_HIT_SPAN * (Math.sqrt(0.75 * 0.25) / 0.5);
      expect(hit(vsGoblinBar)).toBeCloseTo(
        Math.min(1, 0.5 + (0.85 - 0.75) / (2 * expectedSpan)),
        5,
      );
      // And the standard benchmark still uses the flat span exactly.
      const std = computeFireFactor({ ...base, windows: [win(58, 100, 'season')] });
      expect(hit(std)).toBeCloseTo(0.5 + (0.58 - 0.5) / (2 * FIREFACTOR_HIT_SPAN), 5);
    });

    it('a goblin above its high breakeven scores like the same edge on a standard line', () => {
      // Same +10pt edge over the benchmark, same sample sizes: a goblin hitting 85%
      // vs a 75% breakeven must NOT read materially worse than a standard line
      // hitting 60% vs 50% — the old Wilson-center shrinkage erased high-rate edges.
      const goblin = computeFireFactor({
        line: 15,
        windows: [win(9, 10, '5'), win(17, 20, '10'), win(34, 40, '20')],
        projection: 18,
        stdev: 5,
        cv: 0.25,
        matchup: undefined,
        gamesPlayed: 40,
        overOnly: true,
        benchmark: 0.75,
      });
      const standard = computeFireFactor({
        line: 20,
        windows: [win(6, 10, '5'), win(12, 20, '10'), win(24, 40, '20')],
        projection: 21.5,
        stdev: 5,
        cv: 0.25,
        matchup: undefined,
        gamesPlayed: 40,
      });
      expect(goblin.score).toBeGreaterThanOrEqual(FIREFACTOR_TIER_CUTOFFS.slight); // a real read
      expect(goblin.score).toBeGreaterThan(standard.score * 0.6); // comparable, not crushed
    });

    it('benchmark 0.5 reproduces the standard behavior exactly', () => {
      const std = computeFireFactor(base);
      const bench = computeFireFactor({ ...base, benchmark: 0.5 });
      expect(bench.score).toBe(std.score);
      expect(bench.tier).toBe(std.tier);
      expect(bench.side).toBe(std.side);
      expect(bench.trustFactor).toBeCloseTo(std.trustFactor, 10);
    });
  });

  describe('side-priced lines (benchmarkBySide — Sleeper sided multipliers)', () => {
    // 1.36× favorite / 2.84× dog: breakevens 1/1.36 ≈ 0.735 and 1/2.84 ≈ 0.352.
    const sided = { over: 1 / 1.36, under: 1 / 2.84 };

    it('a likely-but-poorly-paid favorite no longer grades high on likelihood alone', () => {
      // ~70% over history — a strong lean vs a coin flip, but well SHORT of the
      // ~74% its 1.36× payout needs: the sided score must drop hard.
      const flat = computeFireFactor(base);
      const value = computeFireFactor({ ...base, benchmarkBySide: sided });
      expect(value.side).toBe('over'); // side still follows history
      expect(value.score).toBeLessThan(flat.score * 0.5);
      expect(value.note).toMatch(/payout-implied ~74% breakeven/i);
    });

    it('a well-paid dog with a modest edge over its low bar reads as real value', () => {
      // History leans under at ~60% — nothing special vs 50%, but far above the
      // ~35% bar the 2.84× under payout needs: a genuine value read.
      const dog: FireFactorInput = {
        ...base,
        windows: [win(4, 10, '5'), win(8, 20, '10'), win(16, 40, '20'), win(25, 62, 'season')],
        projection: 18,
      };
      const flat = computeFireFactor(dog);
      const value = computeFireFactor({ ...dog, benchmarkBySide: sided });
      expect(value.side).toBe('under');
      expect(value.score).toBeGreaterThan(flat.score);
      expect(value.tier).not.toBe('Pass');
    });

    it('an extremely likely favorite still clears its high bar', () => {
      // 90%+ over history DOES clear the ~74% bar — the favorite isn't banned,
      // it just has to be extremely likely, exactly the product intent.
      const lock = computeFireFactor({
        ...base,
        windows: [win(9, 10, '5'), win(19, 20, '10'), win(37, 40, '20'), win(57, 62, 'season')],
        projection: 26,
        benchmarkBySide: sided,
      });
      expect(lock.side).toBe('over');
      expect(lock.score).toBeGreaterThanOrEqual(FIREFACTOR_TIER_CUTOFFS.slight);
    });

    it('even per-side pricing at 0.5/0.5 reproduces the flat behavior exactly', () => {
      const std = computeFireFactor(base);
      const even = computeFireFactor({ ...base, benchmarkBySide: { over: 0.5, under: 0.5 } });
      expect(even.score).toBe(std.score);
      expect(even.tier).toBe(std.tier);
      expect(even.side).toBe(std.side);
    });

    it('benchmarkBySide overrides a flat benchmark when both are supplied', () => {
      const sidedOnly = computeFireFactor({ ...base, benchmarkBySide: sided });
      const both = computeFireFactor({ ...base, benchmark: 0.5, benchmarkBySide: sided });
      expect(both.score).toBe(sidedOnly.score);
    });
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

  it('hit sub-score is 0.5-centered on the RAW rate (50% rate ⇒ neutral)', () => {
    const overs = 58; // ~58% rate — chosen so the sub-score does NOT clamp to 1.0
    const decided = 100;
    const r = computeFireFactor({ ...base, windows: [win(overs, decided, 'season')], gamesPlayed: decided });
    // The magnitude uses the shrinkage-free rate (the Wilson LOWER bound already
    // handles sample uncertainty via the trust factor — counted once, not twice).
    const rate = overs / decided;
    const hit = r.components.find((c) => c.key === 'hit')!.score;
    expect(hit).toBeCloseTo(
      Math.max(0, Math.min(1, 0.5 + (rate - 0.5) / (2 * FIREFACTOR_HIT_SPAN))),
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
