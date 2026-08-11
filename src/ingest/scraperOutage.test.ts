import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every scraper used to catch its own request errors and return []. That made a total
// outage — a 403 IP block, a dead host — indistinguishable from "this book posted
// nothing today", which is how a dead pipeline recorded green runs for days. A source
// that could not reach its upstream at all must now say so.

const scrapeFetch = vi.hoisted(() => vi.fn());
vi.mock('./scrapeFetch', () => ({ scrapeFetch }));

import { fetchRotowireLines } from './rotowire';
import { fetchSleeperLines } from './sleeper';

/** A failing HTTP response (the shape scrapeFetch resolves to). */
const httpError = (status: number) => ({ ok: false, status, headers: new Headers() });
const httpJson = (body: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body });

beforeEach(() => scrapeFetch.mockReset());

describe('a scraper that cannot reach its upstream', () => {
  it('rotowire throws rather than reporting an empty board', async () => {
    scrapeFetch.mockResolvedValue(httpError(403));
    await expect(fetchRotowireLines()).rejects.toThrow(/RotoWire HTTP 403/);
  });

  it('rotowire still returns rows on a good response', async () => {
    scrapeFetch.mockResolvedValue(
      httpJson({
        entities: [{ entityID: 77, eventID: 5, sport: 'MLB', name: 'Test Batter' }],
        markets: [{ marketID: 10, category: 'Game', marketName: 'Hits' }],
        events: [{ eventID: 5, eventTime: 1_784_000_000 }],
        props: [
          { marketID: 10, entities: [77], lines: [{ book: 'draftkings-sb', over: -115, under: -105, line: 1.5 }] },
        ],
      }),
    );
    await expect(fetchRotowireLines()).resolves.toHaveLength(1);
  });

  it('sleeper throws when every line feed is down', async () => {
    scrapeFetch.mockResolvedValue(httpError(503));
    await expect(fetchSleeperLines()).rejects.toThrow(/all \d+ line feeds failed/);
  });

  it('sleeper tolerates ONE feed failing — a partial board is still a board', async () => {
    // Standard + alternate feeds fail independently by design; only losing both is
    // an outage. An empty array from the surviving feed is a legitimate quiet slate.
    scrapeFetch.mockResolvedValueOnce(httpError(503)).mockResolvedValueOnce(httpJson([]));
    await expect(fetchSleeperLines()).resolves.toEqual([]);
  });
});
