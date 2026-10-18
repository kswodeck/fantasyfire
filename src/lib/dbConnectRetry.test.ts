import { describe, expect, it, vi } from 'vitest';
import { isConnectFailure, retryOnConnectFailure } from './dbConnectRetry';

const noWait = () => Promise.resolve();

describe('isConnectFailure', () => {
  it('matches the pg-pool connect timeout (Sentry APP-Q)', () => {
    expect(isConnectFailure(new Error('timeout exceeded when trying to connect'))).toBe(true);
  });

  it('matches the Supavisor checkout timeout (Sentry APP-S)', () => {
    const e = new Error(
      '(ECHECKOUTTIMEOUT) unable to check out connection from the pool after 15000ms in Transaction mode',
    );
    e.name = 'DriverAdapterError';
    expect(isConnectFailure(e)).toBe(true);
  });

  it('matches through a cause chain and by code', () => {
    const inner = new Error('Connection terminated due to connection timeout');
    expect(isConnectFailure(new Error('wrapped', { cause: inner }))).toBe(true);
    expect(isConnectFailure(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(true);
  });

  it('rejects errors that may follow a sent statement', () => {
    expect(isConnectFailure(new Error('Connection terminated unexpectedly'))).toBe(false);
    expect(isConnectFailure(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBe(false);
    expect(isConnectFailure(new Error('canceling statement due to statement timeout'))).toBe(false);
    expect(isConnectFailure(undefined)).toBe(false);
  });
});

describe('retryOnConnectFailure', () => {
  it('retries a connect failure and returns the later result', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))
      .mockResolvedValueOnce('ok');
    await expect(retryOnConnectFailure(fn, { wait: noWait })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after `attempts` and rethrows the last error', async () => {
    const err = new Error('timeout exceeded when trying to connect');
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(err);
    await expect(retryOnConnectFailure(fn, { attempts: 2, wait: noWait })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('never retries a non-connect error', async () => {
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(new Error('unique constraint'));
    await expect(retryOnConnectFailure(fn, { attempts: 3, wait: noWait })).rejects.toThrow('unique constraint');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('attempts: 1 means a single try', async () => {
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(new Error('timeout exceeded when trying to connect'));
    await expect(retryOnConnectFailure(fn, { attempts: 1, wait: noWait })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
