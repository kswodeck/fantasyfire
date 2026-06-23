import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the DB-backed server layer so these tests are pure (no Postgres).
vi.mock('@/lib/server/players', () => ({
  getPlayerResearch: vi.fn(),
  searchPlayers: vi.fn(),
}));

import { GET as hitrateGET } from './hitrate/route';
import { GET as playersGET } from './players/route';
import { GET as playerSlugGET } from './players/[slug]/route';
import { getPlayerResearch, searchPlayers } from '@/lib/server/players';

const mockResearch = vi.mocked(getPlayerResearch);
const mockSearch = vi.mocked(searchPlayers);

function req(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/hitrate', () => {
  it('returns 200 with the research payload for valid input', async () => {
    const payload = { player: { slug: 'luka-doncic' }, stat: 'pts', line: 25.5 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue(payload as any);

    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/hitrate?playerSlug=luka-doncic&stat=pts&line=25.5'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.player.slug).toBe('luka-doncic');
    expect(mockResearch).toHaveBeenCalledWith('luka-doncic', 'pts', 25.5);
  });

  it('omitted line passes undefined (server computes the default)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue({ stat: 'reb' } as any);
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/hitrate?playerSlug=nikola-jokic&stat=reb'),
    );
    expect(res.status).toBe(200);
    expect(mockResearch).toHaveBeenCalledWith('nikola-jokic', 'reb', undefined);
  });

  it('returns 400 for an invalid stat', async () => {
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/hitrate?playerSlug=luka-doncic&stat=bogus&line=20'),
    );
    expect(res.status).toBe(400);
    expect(mockResearch).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed slug', async () => {
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/hitrate?playerSlug=Bad_Slug!&stat=pts&line=20'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for a negative line', async () => {
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/hitrate?playerSlug=luka-doncic&stat=pts&line=-5'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when the player is not found', async () => {
    mockResearch.mockResolvedValue(null);
    const res = await hitrateGET(
      req('http://localhost:3000/api/v1/hitrate?playerSlug=nobody&stat=pts&line=20'),
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/players', () => {
  it('returns 200 with players for a valid query', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSearch.mockResolvedValue([{ slug: 'luka-doncic', fullName: 'Luka Dončić' }] as any);
    const res = await playersGET(req('http://localhost:3000/api/v1/players?q=luka&limit=5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.players).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith('luka', 5);
  });

  it('defaults limit when omitted', async () => {
    mockSearch.mockResolvedValue([]);
    const res = await playersGET(req('http://localhost:3000/api/v1/players'));
    expect(res.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith(undefined, 20);
  });

  it('returns 400 for an out-of-range limit', async () => {
    const res = await playersGET(req('http://localhost:3000/api/v1/players?limit=0'));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/players/[slug]', () => {
  const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it('returns 200 for a valid slug + stat', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockResearch.mockResolvedValue({ stat: 'pts' } as any);
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/players/luka-doncic?stat=pts'),
      ctx('luka-doncic'),
    );
    expect(res.status).toBe(200);
    expect(mockResearch).toHaveBeenCalledWith('luka-doncic', 'pts', undefined);
  });

  it('returns 400 for an invalid stat (no silent coercion)', async () => {
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/players/luka-doncic?stat=bogus'),
      ctx('luka-doncic'),
    );
    expect(res.status).toBe(400);
    expect(mockResearch).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed slug', async () => {
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/players/Bad_Slug'),
      ctx('Bad_Slug'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when the player is not found', async () => {
    mockResearch.mockResolvedValue(null);
    const res = await playerSlugGET(
      req('http://localhost:3000/api/v1/players/nobody'),
      ctx('nobody'),
    );
    expect(res.status).toBe(404);
  });
});
