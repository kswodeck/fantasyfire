import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = {
  $executeRawUnsafe: vi.fn(async () => 0),
  $queryRawUnsafe: vi.fn(async () => [{ ok: 1 }]),
};
const db = {
  $queryRawUnsafe: vi.fn(async () => [{ plain: 1 }]),
  $transaction: vi.fn<(fn: (t: typeof tx) => Promise<unknown>, opts?: unknown) => Promise<unknown>>(
    async (fn) => fn(tx),
  ),
};
vi.mock('@/lib/db', () => ({ db }));

const { leagueScanRaw, optionalScan, isDbUnavailable, resetOptionalScanCooldowns, OPTIONAL_SCAN_COOLDOWN_MS } =
  await import('./leagueScan');

const statementTimeout = () =>
  Object.assign(
    new Error('Raw query failed. Code: `57014`. Message: `canceling statement due to statement timeout`'),
    { code: 'P2010' },
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetOptionalScanCooldowns();
});

describe('leagueScanRaw', () => {
  it('caps the scan with a transaction-local statement_timeout', async () => {
    const out = await leagueScanRaw('SELECT $1, $2', ['a', 2], 20_000);
    expect(out).toEqual([{ ok: 1 }]);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('SET LOCAL statement_timeout = 20000');
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith('SELECT $1, $2', 'a', 2);
    // Client-side transaction timeout sits past the server-side one.
    expect(db.$transaction.mock.calls[0][1]).toEqual({ maxWait: 10_000, timeout: 30_000 });
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('runs plainly with no cap (the build phase)', async () => {
    await expect(leagueScanRaw('SELECT 1', [], null)).resolves.toEqual([{ plain: 1 }]);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('isDbUnavailable', () => {
  it('covers statement timeouts, connect failures and transaction-API errors', () => {
    expect(isDbUnavailable(statementTimeout())).toBe(true);
    expect(isDbUnavailable(new Error('timeout exceeded when trying to connect'))).toBe(true);
    expect(isDbUnavailable(Object.assign(new Error('Transaction API error'), { code: 'P2028' }))).toBe(true);
  });

  it('does not cover real bugs', () => {
    expect(isDbUnavailable(new Error('column "x" does not exist'))).toBe(false);
    expect(isDbUnavailable(new TypeError('cannot read properties of undefined'))).toBe(false);
  });
});

describe('optionalScan', () => {
  it('passes a successful result through', async () => {
    await expect(optionalScan('k', async () => [1, 2], [])).resolves.toEqual([1, 2]);
  });

  it('degrades to the fallback on a statement timeout, then cools down', async () => {
    let t = 1_000;
    const now = () => t;
    const fn = vi.fn(async () => {
      throw statementTimeout();
    });
    await expect(optionalScan('dvp:cbb:F', fn, [], now)).resolves.toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);

    // Inside the cooldown: no new scan, straight to the fallback.
    t += OPTIONAL_SCAN_COOLDOWN_MS - 1;
    await expect(optionalScan('dvp:cbb:F', fn, [], now)).resolves.toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);

    // Other keys are unaffected.
    await expect(optionalScan('dvp:cbb:G', async () => ['g'], [], now)).resolves.toEqual(['g']);

    // After it: asks again.
    t += 1;
    fn.mockResolvedValueOnce(['fresh'] as never);
    await expect(optionalScan('dvp:cbb:F', fn, [], now)).resolves.toEqual(['fresh']);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows anything that is not the database being unavailable', async () => {
    const bug = new Error('column "x" does not exist');
    await expect(optionalScan('k', async () => Promise.reject(bug), [])).rejects.toBe(bug);
  });
});
