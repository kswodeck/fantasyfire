import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/geo', { headers });
}

describe('GET /api/v1/geo', () => {
  it('echoes the edge geo headers', async () => {
    const res = await GET(
      req({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'MI' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ country: 'US', region: 'MI' });
  });

  it('returns nulls when the host attaches no geo (local dev, self-hosting)', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    // Nulls, not undefined or absent keys — the client checks for them by name.
    expect(await res.json()).toEqual({ country: null, region: null });
  });

  it('normalises empty header values to null rather than empty strings', async () => {
    // An empty string is falsy but would still serialise as "", and
    // bookAvailability would then see a present-but-meaningless value.
    const res = await GET(
      req({ 'x-vercel-ip-country': '', 'x-vercel-ip-country-region': '' }),
    );
    expect(await res.json()).toEqual({ country: null, region: null });
  });

  it('handles a country with no region', async () => {
    const res = await GET(req({ 'x-vercel-ip-country': 'GB' }));
    expect(await res.json()).toEqual({ country: 'GB', region: null });
  });

  it('is never cached — the answer is per-reader', async () => {
    // A shared cache hit here would hand one reader's region to another.
    const res = await GET(req({ 'x-vercel-ip-country': 'US' }));
    const cacheControl = res.headers.get('Cache-Control') ?? '';
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).not.toContain('s-maxage');
  });

  it('returns nothing finer than a region', async () => {
    const res = await GET(
      req({
        'x-vercel-ip-country': 'US',
        'x-vercel-ip-country-region': 'CA',
        // Vercel also attaches these; they must not leak into the response.
        'x-vercel-ip-city': 'San Francisco',
        'x-vercel-ip-latitude': '37.77',
        'x-vercel-ip-longitude': '-122.41',
        'x-forwarded-for': '203.0.113.7',
      }),
    );
    expect(Object.keys(await res.json()).sort()).toEqual(['country', 'region']);
  });
});
