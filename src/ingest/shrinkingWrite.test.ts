import { describe, it, expect, vi } from 'vitest';
import { writeInShrinkingChunks, UPSERT_CHUNK, UPSERT_MIN_CHUNK } from './providedSync';
import { isStatementTimeout } from './dbRetry';

// Two runs in two days (2026-09-25 09:58, 2026-09-26 09:40 UTC) died on a Postgres
// statement timeout during the bulk upsert. Same code, same volume as every green run
// that day — the database was ~20x slow in that window. The write loop now shrinks
// its statements instead of dying on the first one that overruns.

/** The error Prisma actually threw in the failing run (P2010 wrapping SQLSTATE 57014). */
const statementTimeout = () =>
  Object.assign(
    new Error(
      'Invalid `prisma.$executeRawUnsafe()` invocation:\n\nRaw query failed. Code: `57014`. ' +
        'Message: `canceling statement due to statement timeout`',
    ),
    { code: 'P2010' },
  );

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A typed write mock, so `mock.calls` knows each call carries its chunk. */
type Write = (chunk: readonly number[]) => Promise<void>;
const writer = (impl: Write = async () => {}) => vi.fn<Write>(impl);

describe('isStatementTimeout', () => {
  it('recognises the error Prisma threw in the failing run', () => {
    expect(isStatementTimeout(statementTimeout())).toBe(true);
  });

  it('recognises the structured SQLSTATE when Prisma supplies it', () => {
    expect(isStatementTimeout({ meta: { code: '57014' } })).toBe(true);
  });

  it('does not mistake a connection blip or a real query bug for one', () => {
    expect(isStatementTimeout(new Error('Connection terminated due to connection timeout'))).toBe(false);
    expect(isStatementTimeout(new Error('column "nope" does not exist'))).toBe(false);
  });
});

describe('writeInShrinkingChunks', () => {
  it('writes in full chunks when nothing goes wrong', async () => {
    const write = writer();
    const r = await writeInShrinkingChunks(rows(2500), write, { isTimeout: isStatementTimeout });

    expect(write.mock.calls.map(([c]) => c.length)).toEqual([1000, 1000, 500]);
    expect(r).toEqual({ statements: 3, finalChunk: UPSERT_CHUNK });
  });

  it('resends the rows that timed out as smaller statements, and keeps going', async () => {
    // The database can't finish anything above 300 rows — the degraded window.
    const write = writer(async (chunk) => {
      if (chunk.length > 300) throw statementTimeout();
    });
    const onShrink = vi.fn();
    const r = await writeInShrinkingChunks(rows(1000), write, {
      isTimeout: isStatementTimeout,
      onShrink,
    });

    // 1000 and 500 time out; 250 lands, and the rest of the run stays at 250.
    expect(onShrink.mock.calls.map(([i]) => [i.from, i.to])).toEqual([
      [1000, 500],
      [500, 250],
    ]);
    expect(r.finalChunk).toBe(250);
    // Every row was written exactly once across the successful statements.
    const written = write.mock.calls
      .filter(([c]) => c.length <= 300)
      .flatMap(([c]) => c);
    expect(written).toEqual(rows(1000));
  });

  it('resumes from the failure point — rows already committed are not resent', async () => {
    let calls = 0;
    const write = writer(async (chunk) => {
      calls++;
      // Chunk one lands at full size; the database degrades mid-run.
      if (calls > 1 && chunk.length > 500) throw statementTimeout();
    });
    await writeInShrinkingChunks(rows(2000), write, { isTimeout: isStatementTimeout });

    const starts = write.mock.calls.map(([c]) => c[0]);
    // 0 (1000, ok) → 1000 (1000, timeout) → 1000 (500) → 1500 (500)
    expect(starts).toEqual([0, 1000, 1000, 1500]);
  });

  it('gives up at the floor rather than shrinking forever', async () => {
    const write = writer(async () => {
      throw statementTimeout();
    });
    await expect(
      writeInShrinkingChunks(rows(1000), write, { isTimeout: isStatementTimeout }),
    ).rejects.toThrow(/statement timeout/);

    // 1000, 500, 250, 125 — four wasted statements at most, then a loud failure.
    expect(write.mock.calls.map(([c]) => c.length)).toEqual([1000, 500, 250, UPSERT_MIN_CHUNK]);
  });

  it('never absorbs an error that is not a timeout', async () => {
    const write = writer(async () => {
      throw new Error('column "nope" does not exist');
    });
    await expect(
      writeInShrinkingChunks(rows(1000), write, { isTimeout: isStatementTimeout }),
    ).rejects.toThrow(/does not exist/);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('handles an empty write without touching the database', async () => {
    const write = writer();
    await expect(
      writeInShrinkingChunks([], write, { isTimeout: isStatementTimeout }),
    ).resolves.toEqual({ statements: 0, finalChunk: UPSERT_CHUNK });
    expect(write).not.toHaveBeenCalled();
  });
});
