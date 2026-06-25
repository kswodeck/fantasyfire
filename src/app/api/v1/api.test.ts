import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the DB-backed server layer so these tests are pure (no Postgres).
vi.mock('@/lib/server/players', () => ({
  getPlayerResearch: vi.fn(),
  searchPlayers: vi.fn(),
}));

import { GET as hitrateGET } from './[sport]/hitrate/route';
import { GET as playersGET } from './[sport]/players/route';
import { GET as playerSlugGET } from './[sport]/players/[slug]/route';
import { getPlayerResearch, searchPlayers } from '@/lib/server/players';

const mockResearch = vi.mocked(getPlayerResearch);
const mockSearch = vi.mocked(searchPlayers);

function req(url: string): NextRequest {
  return new NextRequest(url);
}
const sportCtx = (sport: string) => ({ params: Promise.resolve({ sport }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/{sport}/hitrate', () => {
  it('returns 200 with the research payload for valid input', async () => {
    const payload = { player: { slug: 'luka-doncic' }, stat: 'pts', line: 25.5 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue(payload as any);

    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nba/hitrate?playerSlug=luka-doncic&stat=pts&line=25.5'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.player.slug).toBe('luka-doncic');
    expect(mockResearch).toHaveBeenCalledWith('nba', 'luka-doncic', 'pts', 25.5, undefined);
  });

  it('omitted line passes undefined (server computes the default)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue({ stat: 'reb' } as any);
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nba/hitrate?playerSlug=nikola-jokic&stat=reb'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(200);
    expect(mockResearch).toHaveBeenCalledWith('nba', 'nikola-jokic', 'reb', undefined, undefined);
  });

  it('works for an MLB stat key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue({ stat: 'hits' } as any);
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/mlb/hitrate?playerSlug=aaron-judge&stat=hits'),
      sportCtx('mlb'),
    );
    expect(res.status).toBe(200);
    expect(mockResearch).toHaveBeenCalledWith('mlb', 'aaron-judge', 'hits', undefined, undefined);
  });

  it('forwards the source query param (the chosen book)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue({ stat: 'pts' } as any);
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nba/hitrate?playerSlug=luka-doncic&stat=pts&source=underdog'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(200);
    expect(mockResearch).toHaveBeenCalledWith('nba', 'luka-doncic', 'pts', undefined, 'underdog');
  });

  it('returns 404 for an unknown sport', async () => {
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nhl/hitrate?playerSlug=luka-doncic&stat=pts'),
      sportCtx('nhl'),
    );
    expect(res.status).toBe(404);
    expect(mockResearch).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid stat', async () => {
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nba/hitrate?playerSlug=luka-doncic&stat=bogus&line=20'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(400);
    expect(mockResearch).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed slug', async () => {
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nba/hitrate?playerSlug=Bad_Slug!&stat=pts&line=20'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for a negative line', async () => {
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nba/hitrate?playerSlug=luka-doncic&stat=pts&line=-5'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when the player is not found', async () => {
    mockResearch.mockResolvedValue(null);
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/nba/hitrate?playerSlug=nobody&stat=pts&line=20'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/{sport}/players', () => {
  it('returns 200 with players for a valid query', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSearch.mockResolvedValue([{ slug: 'luka-doncic', fullName: 'Luka Dončić' }] as any);
    const res = await playersGET(
      req('http://localhost:3000/api/v1/nba/players?q=luka&limit=5'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.players).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith('nba', 'luka', 5);
  });

  it('defaults limit when omitted', async () => {
    mockSearch.mockResolvedValue([]);
    const res = await playersGET(
      req('http://localhost:3000/api/v1/mlb/players'),
      sportCtx('mlb'),
    );
    expect(res.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith('mlb', undefined, 20);
  });

  it('returns 404 for an unknown sport', async () => {
    const res = await playersGET(
      req('http://localhost:3000/api/v1/nhl/players'),
      sportCtx('nhl'),
    );
    expect(res.status).toBe(404);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('returns 400 for an out-of-range limit', async () => {
    const res = await playersGET(
      req('http://localhost:3000/api/v1/nba/players?limit=0'),
      sportCtx('nba'),
    );
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/{sport}/players/[slug]', () => {
  const ctx = (sport: string, slug: string) => ({ params: Promise.resolve({ sport, slug }) });

  it('returns 200 for a valid slug + stat', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue({ stat: 'pts' } as any);
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/nba/players/luka-doncic?stat=pts'),
      ctx('nba', 'luka-doncic'),
    );
    expect(res.status).toBe(200);
    expect(mockResearch).toHaveBeenCalledWith('nba', 'luka-doncic', 'pts', undefined, undefined);
  });

  it('returns 400 for an invalid stat (no silent coercion)', async () => {
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/nba/players/luka-doncic?stat=bogus'),
      ctx('nba', 'luka-doncic'),
    );
    expect(res.status).toBe(400);
    expect(mockResearch).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed slug', async () => {
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/nba/players/Bad_Slug'),
      ctx('nba', 'Bad_Slug'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown sport', async () => {
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/nhl/players/luka-doncic'),
      ctx('nhl', 'luka-doncic'),
    );
    expect(res.status).toBe(404);
    expect(mockResearch).not.toHaveBeenCalled();
  });

  it('returns 404 when the player is not found', async () => {
    mockResearch.mockResolvedValue(null);
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/nba/players/nobody'),
      ctx('nba', 'nobody'),
    );
    expect(res.status).toBe(404);
  });
});
