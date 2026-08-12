import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESPN_HEADERS, ESPN_RETRY_STATUS } from './espnHttp';

// The WNBA/NHL/MLS/CFB/CBB/NFL pulls all started returning
//   ESPN HTTP 403: https://site.api.espn.com/.../wnba/teams?limit=60
// on the very first request. Every ESPN caller identified itself as a bot
// ("FantasyFire/1.0") from a datacenter IP; the line scrapers in this same
// directory have always sent browser headers and were unaffected.

describe('ESPN_HEADERS', () => {
  it('does not self-identify as a bot', () => {
    expect(ESPN_HEADERS['User-Agent']).not.toMatch(/FantasyFire|bot|crawler/i);
    expect(ESPN_HEADERS['User-Agent']).toMatch(/^Mozilla\/5\.0 /);
  });

  it('sends the context a browser would alongside the UA', () => {
    // A lone browser UA with no Accept/Referer is its own tell.
    expect(ESPN_HEADERS.Accept).toMatch(/application\/json/);
    expect(ESPN_HEADERS.Referer).toMatch(/espn\.com/);
    expect(ESPN_HEADERS.Origin).toMatch(/espn\.com/);
  });
});

describe('ESPN_RETRY_STATUS', () => {
  it('retries the transient statuses', () => {
    for (const s of [429, 500, 502, 503, 504]) expect(ESPN_RETRY_STATUS(s), String(s)).toBe(true);
  });

  it('retries 403 — edge bot verdicts are per-node, not always consistent', () => {
    expect(ESPN_RETRY_STATUS(403)).toBe(true);
  });

  it('does not retry a genuine client error', () => {
    for (const s of [400, 401, 404, 410]) expect(ESPN_RETRY_STATUS(s), String(s)).toBe(false);
  });

  it('does not retry success', () => {
    expect(ESPN_RETRY_STATUS(200)).toBe(false);
    expect(ESPN_RETRY_STATUS(304)).toBe(false);
  });
});

describe('every ESPN caller uses the shared headers', () => {
  // The duplication is what made all six jobs fail together and would make the
  // next header change miss one. Guard against a new caller (or a revert)
  // reintroducing a hand-rolled UA.
  const FILES = [
    'src/ingest/espnSports.ts',
    'src/ingest/espn.ts',
    'src/ingest/nfl/client.ts',
    'src/ingest/injuries.ts',
    'src/ingest/gameOdds.ts',
    'src/ingest/schedule.ts',
  ];

  it.each(FILES)('%s references ESPN_HEADERS and hard-codes no User-Agent', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toContain('ESPN_HEADERS');
    expect(src).not.toMatch(/'User-Agent':/);
  });
});
