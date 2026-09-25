import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The workflow went red because run-injuries had NO db retry and no per-sport
// isolation: one transient pooler timeout — the exact failure dbRetry.ts exists for —
// threw straight out of the sport loop and failed the whole job, even though every
// sport's ESPN feed had been fetched fine.

const playerInjury = vi.hoisted(() => ({ deleteMany: vi.fn(), createMany: vi.fn() }));
const player = vi.hoisted(() => ({ findMany: vi.fn() }));
const $transaction = vi.hoisted(() => vi.fn());
const recordIngestRun = vi.hoisted(() => vi.fn());
const fetchEspnInjuries = vi.hoisted(() => vi.fn());

vi.mock('../lib/db', () => ({ db: { playerInjury, player, $transaction, $disconnect: vi.fn() } }));
vi.mock('./ingestRun', () => ({ recordIngestRun }));
vi.mock('./injuries', () => ({ fetchEspnInjuries }));
// Every sport in season, so the loop takes the full fetch+write path each time.
vi.mock('../lib/seasonWindow', () => ({
  shouldIngest: () => true,
  offSeasonReason: () => 'off-season',
}));

/** pg-pool's connect timeout — what dbRetry classes as transient. */
const timeout = () => new Error('Connection terminated due to connection timeout');

/** Import the module and return the main() it hands recordIngestRun. */
async function loadMain(): Promise<() => Promise<number>> {
  vi.resetModules();
  recordIngestRun.mockImplementation(() => Promise.resolve());
  await import('./run-injuries');
  expect(recordIngestRun).toHaveBeenCalledWith('injuries', expect.any(Function));
  return recordIngestRun.mock.calls.at(-1)![1] as () => Promise<number>;
}

/**
 * Start main() and let dbRetry's backoff elapse on fake timers. Eight sports x four
 * attempts is ~28s of real sleeping otherwise — correct in a cron with a 10-minute
 * budget, far too slow for a unit suite.
 */
async function runMain(main: () => Promise<number>): Promise<number> {
  // Attach the handlers BEFORE advancing: main() can reject while the clock is being
  // wound forward, and an unattached rejection surfaces as an unhandled error.
  const settled = main().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  // Settle the await chain between backoffs as the clock moves.
  await vi.advanceTimersByTimeAsync(120_000);
  const result = await settled;
  if (!result.ok) throw result.error;
  return result.value;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  fetchEspnInjuries.mockResolvedValue([
    { externalName: 'Test Player', status: 'out', rawStatus: 'Out', fantasyStatus: null,
      detail: null, returnDate: null, comment: null, news: null, reportedAt: null },
  ]);
  player.findMany.mockResolvedValue([{ id: 1, firstName: 'Test', lastName: 'Player' }]);
  playerInjury.deleteMany.mockResolvedValue({ count: 0 });
  $transaction.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('run-injuries against a blipping pooler', () => {
  it('retries a transient connect timeout instead of failing the run', async () => {
    // The roster read fails once for the first sport, then recovers.
    player.findMany.mockRejectedValueOnce(timeout());
    const main = await loadMain();

    await expect(runMain(main)).resolves.toBeGreaterThan(0);
    // 8 sports + the one retried attempt.
    expect(player.findMany).toHaveBeenCalledTimes(9);
  });

  it('keeps the other sports when one exhausts its retries', async () => {
    // dbRetry gives 4 attempts; fail all of them for the first sport only.
    player.findMany
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(timeout());
    const main = await loadMain();

    const total = await runMain(main);
    expect(total).toBeGreaterThan(0); // the remaining sports still stored
    expect($transaction).toHaveBeenCalled();
  });

  it('still fails loudly when every sport fails — an outage is not a blip', async () => {
    player.findMany.mockRejectedValue(timeout());
    const main = await loadMain();

    await expect(runMain(main)).rejects.toThrow(/all 8 sports failed/);
  });

  it('does not retry a genuine query bug', async () => {
    player.findMany.mockRejectedValue(new Error('column "nope" does not exist'));
    const main = await loadMain();

    await expect(runMain(main)).rejects.toThrow(/all 8 sports failed/);
    // One attempt per sport — no retry storm on a real bug.
    expect(player.findMany).toHaveBeenCalledTimes(8);
  });
});
