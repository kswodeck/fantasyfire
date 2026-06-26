import { describe, it, expect } from 'vitest';
import { cutoff, prunePlan, PROVIDED_LINE_KEEP_DAYS, INGEST_RUN_KEEP_DAYS } from './prune';

describe('prune retention windows', () => {
  it('cutoff is UTC midnight N days before now', () => {
    const now = new Date('2026-06-25T13:45:12.000Z');
    expect(cutoff(now, 30).toISOString()).toBe('2026-05-26T00:00:00.000Z');
    expect(cutoff(now, 90).toISOString()).toBe('2026-03-27T00:00:00.000Z');
    expect(cutoff(now, 0).toISOString()).toBe('2026-06-25T00:00:00.000Z');
  });

  it('cutoff crosses month/year boundaries correctly', () => {
    expect(cutoff(new Date('2026-01-05T08:00:00Z'), 10).toISOString()).toBe('2025-12-26T00:00:00.000Z');
  });

  it('does not mutate the input date', () => {
    const now = new Date('2026-06-25T13:45:12.000Z');
    const iso = now.toISOString();
    cutoff(now, 30);
    expect(now.toISOString()).toBe(iso);
  });

  it('prunePlan resolves both cutoffs for the run time', () => {
    const plan = prunePlan(new Date('2026-06-25T13:45:12.000Z'));
    expect(plan.providedLineBefore.toISOString()).toBe('2026-05-26T00:00:00.000Z');
    expect(plan.ingestRunBefore.toISOString()).toBe('2026-03-27T00:00:00.000Z');
  });

  it('keeps ProvidedLine longer than its read windows (3d board, 14d research)', () => {
    // Invariant: pruning must never reach inside a window the app still reads.
    expect(PROVIDED_LINE_KEEP_DAYS).toBeGreaterThan(14);
  });

  it('keeps IngestRun well beyond the /status 200-row slice', () => {
    expect(INGEST_RUN_KEEP_DAYS).toBeGreaterThanOrEqual(30);
  });
});
