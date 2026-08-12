import { describe, it, expect } from 'vitest';
import { droughtFailure } from './providedSync';

// The regression: a provided-lines run that fetched nothing from any book used to
// `return 0` as a SUCCESS. Every scraper swallowed its own request errors, the runner
// swallowed the rest, and a dead pipeline recorded a healthy run — so the site served
// its own median lines for days behind a green ingest and nobody was told.

const none = new Map<string, string>();

describe('droughtFailure', () => {
  it('fails the run when anything is in season', () => {
    const msg = droughtFailure(['mlb', 'wnba'], none);
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/mlb\/wnba/);
    expect(msg).toMatch(/in season/);
  });

  it('allows a genuine off-season drought', () => {
    // Every sport gated off — no book posts props for nothing, so 0 rows is correct
    // and the job should stay green rather than cry wolf every 15 minutes.
    expect(droughtFailure([], none)).toBeNull();
  });

  it('names the sources that failed, so the log says which book broke', () => {
    const failed = new Map([
      ['prizepicks', 'PrizePicks: all 6 league requests failed — 2: HTTP 403'],
      ['rotowire', 'RotoWire HTTP 503'],
    ]);
    const msg = droughtFailure(['mlb'], failed)!;
    expect(msg).toContain('prizepicks');
    expect(msg).toContain('HTTP 403');
    expect(msg).toContain('rotowire');
  });

  it('calls out the stranger case where nothing errored and nothing came back', () => {
    // Silent zeros across the board mean the parsers stopped matching (a feed shape
    // change), which reads very differently from an outage when you're debugging.
    const msg = droughtFailure(['mlb'], none)!;
    expect(msg).toMatch(/no source even reported a failure/i);
  });

  it('agrees with itself grammatically on a single sport', () => {
    expect(droughtFailure(['mlb'], none)).toMatch(/mlb is in season/);
    expect(droughtFailure(['mlb', 'nfl'], none)).toMatch(/mlb\/nfl are in season/);
  });
});
