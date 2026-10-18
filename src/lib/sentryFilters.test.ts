import { describe, expect, it } from 'vitest';
import { THIRD_PARTY_SCRIPT_URLS } from './sentryFilters';

const denied = (url: string) => THIRD_PARTY_SCRIPT_URLS.some((re) => re.test(url));

describe('THIRD_PARTY_SCRIPT_URLS', () => {
  it('matches the Speed Insights script from APP-G, raw and SDK-rewritten', () => {
    expect(denied('https://www.fantasyfire.app/b4cf67676104b32f/script.js')).toBe(true);
    expect(denied('app:///b4cf67676104b32f/script.js')).toBe(true);
  });

  it('matches the other third-party scripts we load', () => {
    expect(denied('https://www.fantasyfire.app/_vercel/speed-insights/script.js')).toBe(true);
    expect(denied('https://va.vercel-scripts.com/v1/speed-insights/script.js')).toBe(true);
    expect(denied('https://cloud.umami.is/script.js')).toBe(true);
    expect(denied('https://www.googletagmanager.com/gtag/js?id=G-TRK9V04018')).toBe(true);
    expect(denied('chrome-extension://abcdefghijklmnop/content.js')).toBe(true);
  });

  it('never matches our own code', () => {
    expect(denied('https://www.fantasyfire.app/_next/static/chunks/0yzzj-m-jhokg.js')).toBe(false);
    expect(denied('app:///_next/static/chunks/turbopack-2i6fzkf0ih6f0.js')).toBe(false);
    expect(denied('https://www.fantasyfire.app/mlb/chandler-simpson')).toBe(false);
    expect(denied('https://www.fantasyfire.app/sw.js')).toBe(false);
  });
});
