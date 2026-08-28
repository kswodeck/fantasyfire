import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retryInPasses,
  SYSTEMIC_MIN_ITEMS,
  SYSTEMIC_FAILURE_STREAK,
  type RetryTimings,
} from './retryPasses';

// Zero timings — the real ones sleep 30/60/90s per pass plus 500ms per item, which is
// exactly the cost under test; the LOGIC is what these assert.
const fast: RetryTimings = { passBaseMs: 0, itemGapMs: 0 };

const items = (n: number): string[] => Array.from({ length: n }, (_, i) => `d${i}`);

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('retryInPasses', () => {
  it('returns nothing when every item succeeds on the first pass', async () => {
    const attempt = vi.fn(async () => {});
    const left = await retryInPasses('t', items(5), attempt, (d) => d, fast);
    expect(left).toEqual([]);
    expect(attempt).toHaveBeenCalledTimes(5);
  });

  it('drops items as they succeed, so each pass retries a smaller set', async () => {
    // d0 fails once, d1 fails twice, d2 never fails.
    const remaining = new Map([
      ['d0', 1],
      ['d1', 2],
    ]);
    const attempt = vi.fn(async (d: string) => {
      const n = remaining.get(d) ?? 0;
      if (n > 0) {
        remaining.set(d, n - 1);
        throw new Error('flake');
      }
    });
    const left = await retryInPasses('t', items(3), attempt, (d) => d, fast);
    expect(left).toEqual([]);
    // pass 1 tries d0,d1,d2 -> d2 clears; pass 2 tries d0,d1 -> d0 clears; pass 3 tries d1.
    expect(attempt).toHaveBeenCalledTimes(3 + 2 + 1);
  });

  it('gives up after the configured number of passes', async () => {
    const attempt = vi.fn(async () => {
      throw new Error('down');
    });
    // 3 items is below SYSTEMIC_MIN_ITEMS, so the short-circuit must NOT engage:
    // 3 items x 3 passes = 9 attempts.
    const left = await retryInPasses('t', items(3), attempt, (d) => d, { ...fast, passes: 3 });
    expect(left).toHaveLength(3);
    expect(attempt).toHaveBeenCalledTimes(9);
  });

  it('keeps grinding a SMALL set even when nothing succeeds', async () => {
    const n = SYSTEMIC_MIN_ITEMS - 1;
    const attempt = vi.fn(async () => {
      throw new Error('down');
    });
    const left = await retryInPasses('t', items(n), attempt, (d) => d, { ...fast, passes: 2 });
    expect(left).toHaveLength(n);
    expect(attempt).toHaveBeenCalledTimes(n * 2); // no short-circuit below the floor
  });

  describe('systemic-outage short circuit', () => {
    it('abandons a LARGE set after a wall of consecutive failures', async () => {
      // The CFB case: ~350 dates, source refusing all of them.
      const n = 350;
      const attempt = vi.fn(async () => {
        throw new Error('403');
      });
      const left = await retryInPasses('t', items(n), attempt, (d) => d, { ...fast, passes: 3 });

      // Bails after the streak instead of 350 x 3 = 1050 attempts.
      expect(attempt).toHaveBeenCalledTimes(SYSTEMIC_FAILURE_STREAK);
      // Everything still comes back, so the caller's fatal/skippable split is intact.
      expect(left).toHaveLength(n);
      expect(new Set(left).size).toBe(n);
    });

    it('returns the untried remainder, not just what it actually attempted', async () => {
      const n = 100;
      const attempt = vi.fn(async () => {
        throw new Error('down');
      });
      const left = await retryInPasses('t', items(n), attempt, (d) => d, fast);
      // The caller must still see d99 even though it was never tried.
      expect(left).toContain('d0');
      expect(left).toContain('d99');
      expect(left).toEqual(items(n));
    });

    it('does NOT fire when successes keep breaking the streak', async () => {
      const n = 60;
      // Every 5th item succeeds, so the streak never reaches the threshold.
      const attempt = vi.fn(async (d: string) => {
        if (Number(d.slice(1)) % 5 === 0) return;
        throw new Error('flaky');
      });
      const left = await retryInPasses('t', items(n), attempt, (d) => d, { ...fast, passes: 1 });
      expect(attempt).toHaveBeenCalledTimes(n); // full pass, no early exit
      expect(left).toHaveLength(n - n / 5);
    });

    it('fires on a later pass too, not just the first', async () => {
      const n = 50;
      let call = 0;
      // Pass 1: every other item succeeds, so the streak keeps resetting and the whole
      // pass runs — leaving exactly 25 pending, still at the floor. The source then
      // goes fully down, so pass 2 short-circuits after the streak.
      const attempt = vi.fn(async () => {
        call++;
        if (call <= n && call % 2 === 0) return;
        throw new Error('down');
      });
      const left = await retryInPasses('t', items(n), attempt, (d) => d, { ...fast, passes: 3 });
      expect(attempt).toHaveBeenCalledTimes(n + SYSTEMIC_FAILURE_STREAK);
      expect(left).toHaveLength(n / 2);
    });
  });
});
