import { describe, it, expect } from 'vitest';
import { altLineTable } from './altLines';

describe('altLineTable', () => {
  // 10 games: values 20..29 (one each).
  const values = [29, 28, 27, 26, 25, 24, 23, 22, 21, 20];

  it('centers the window on the current line and returns ascending rows', () => {
    const rows = altLineTable(values, 24.5);
    expect(rows.map((r) => r.line)).toEqual([21.5, 22.5, 23.5, 24.5, 25.5, 26.5, 27.5]);
    expect(rows.find((r) => r.isCurrent)?.line).toBe(24.5);
  });

  it('computes over rate at each line (pushes-free .5 lines)', () => {
    const rows = altLineTable(values, 24.5, { steps: 1 });
    // line 23.5 -> overs = #games > 23.5 = {24..29} = 6 of 10
    expect(rows[0]).toMatchObject({ line: 23.5, overs: 6, unders: 4, decided: 10 });
    expect(rows[0].hitRateOver).toBeCloseTo(0.6, 10);
    // line 24.5 -> overs = {25..29} = 5 of 10
    expect(rows[1]).toMatchObject({ line: 24.5, overs: 5, decided: 10 });
    // line 25.5 -> overs = {26..29} = 4 of 10
    expect(rows[2]).toMatchObject({ line: 25.5, overs: 4, decided: 10 });
  });

  it('the over rate falls monotonically as the line rises', () => {
    const rows = altLineTable(values, 24.5);
    const rates = rows.map((r) => r.hitRateOver ?? 0);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
  });

  it('counts pushes on integer lines and excludes them from the denominator', () => {
    // line 25 -> over {26..29}=4, under {20..24}=5, push {25}=1, decided=9
    const rows = altLineTable(values, 25, { steps: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ line: 25, overs: 4, unders: 5, pushes: 1, decided: 9 });
    expect(rows[0].hitRateOver).toBeCloseTo(4 / 9, 10);
  });

  it('never emits a line below 0.5 but always keeps the current line', () => {
    const rows = altLineTable(values, 1.5, { steps: 3, step: 1 });
    expect(rows.every((r) => r.line >= 0.5)).toBe(true);
    expect(rows.some((r) => r.isCurrent && r.line === 1.5)).toBe(true);
  });

  it('returns wide [0,1]-ish Wilson bounds on no decided games', () => {
    const rows = altLineTable([], 24.5, { steps: 0 });
    expect(rows[0].decided).toBe(0);
    expect(rows[0].hitRateOver).toBeNull();
    expect(rows[0].wilsonLower).toBe(0);
    expect(rows[0].wilsonUpper).toBe(1);
  });
});
