import { afterEach, describe, expect, it, vi } from 'vitest';

const cachedSpy = vi.fn<(...args: unknown[]) => Promise<string>>(async () => 'from-data-cache');
const unstableCache = vi.fn<(...args: unknown[]) => typeof cachedSpy>(() => cachedSpy);
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }));

const { sharedCache } = await import('./sharedCache');

afterEach(() => {
  vi.unstubAllEnvs();
  cachedSpy.mockClear();
});

describe('sharedCache', () => {
  it('registers the key parts and TTL with unstable_cache', () => {
    const fn = async (s: string) => s;
    sharedCache(fn, ['dvp', 'v1'], 600);
    expect(unstableCache).toHaveBeenLastCalledWith(fn, ['dvp', 'v1'], { revalidate: 600 });
  });

  it('reads through the data cache inside Next', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const fn = vi.fn(async (s: string) => `direct-${s}`);
    await expect(sharedCache(fn, ['k'], 60)('nba')).resolves.toBe('from-data-cache');
    expect(cachedSpy).toHaveBeenCalledWith('nba');
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs the function directly outside Next (ingest scripts, tests)', async () => {
    vi.stubEnv('NEXT_RUNTIME', '');
    const fn = vi.fn(async (s: string) => `direct-${s}`);
    await expect(sharedCache(fn, ['k'], 60)('nba')).resolves.toBe('direct-nba');
    expect(cachedSpy).not.toHaveBeenCalled();
  });
});
