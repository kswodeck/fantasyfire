import { describe, it, expect } from 'vitest';
import { calibrationVerdict } from './calibrationVerdict';
import type { Calibration, CalibrationBucket } from './types';

function bucket(label: string, decided: number, winRate: number, lower: number): CalibrationBucket {
  return { label, decided, wins: Math.round(decided * winRate), winRate, lower, upper: 1 };
}

function cal(totalGraded: number, buckets: CalibrationBucket[]): Calibration {
  return { totalGraded, overallWinRate: 0.5, trackingSince: '2026-01-01', buckets };
}

describe('calibrationVerdict', () => {
  it('is insufficient (experimental) below the min graded count', () => {
    const v = calibrationVerdict(cal(40, []));
    expect(v.status).toBe('insufficient');
    expect(v.badge).toBe('experimental');
  });

  it('is validated when strong leans clear 50% on the lower bound and discriminate', () => {
    const v = calibrationVerdict(
      cal(300, [
        bucket('Strong lean', 80, 0.62, 0.53),
        bucket('Lean', 90, 0.56, 0.48),
        bucket('Slight lean', 80, 0.52, 0.44),
        bucket('No lean', 50, 0.5, 0.4),
      ]),
    );
    expect(v.status).toBe('validated');
    expect(v.badge).toBe('validated');
  });

  it('is developing when strong leans do not clear 50% on the lower bound', () => {
    const v = calibrationVerdict(
      cal(300, [
        bucket('Strong lean', 80, 0.55, 0.47), // lower bound below 0.5
        bucket('Slight lean', 80, 0.5, 0.42),
      ]),
    );
    expect(v.status).toBe('developing');
  });

  it('is developing when tiers do not discriminate', () => {
    const v = calibrationVerdict(
      cal(300, [
        bucket('Strong lean', 80, 0.55, 0.52), // clears 50 but…
        bucket('Slight lean', 80, 0.54, 0.46), // …barely above slight (< 3pp)
      ]),
    );
    expect(v.status).toBe('developing');
  });

  it('needs enough strong-lean sample even with a high rate', () => {
    const v = calibrationVerdict(
      cal(300, [
        bucket('Strong lean', 10, 0.8, 0.55), // only 10 decided
        bucket('Slight lean', 200, 0.5, 0.43),
      ]),
    );
    expect(v.status).toBe('developing');
  });
});
