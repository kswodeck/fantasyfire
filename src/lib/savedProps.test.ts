import { describe, it, expect } from 'vitest';
import { isPropExpired, type SavedProp } from './savedProps';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-06-28T20:00:00Z');

const mk = (over: Partial<SavedProp>): SavedProp => ({
  sport: 'mlb',
  slug: 'a-player',
  name: 'A Player',
  team: 'STL',
  stat: 'hits',
  line: 1.5,
  side: 'over',
  source: 'prizepicks',
  savedAt: NOW,
  gameDate: null,
  gameStartTime: null,
  ...over,
});

describe('isPropExpired', () => {
  it('never expires a pick with no game (off-season save)', () => {
    expect(isPropExpired(mk({}), NOW)).toBe(false);
  });

  it('clears a start-time pick once its game is safely over (MLB 5h)', () => {
    const longOver = new Date(NOW - 6 * HOUR).toISOString();
    const justStarted = new Date(NOW - 1 * HOUR).toISOString();
    const upcoming = new Date(NOW + 2 * HOUR).toISOString();
    expect(isPropExpired(mk({ gameStartTime: longOver }), NOW)).toBe(true);
    expect(isPropExpired(mk({ gameStartTime: justStarted }), NOW)).toBe(false);
    expect(isPropExpired(mk({ gameStartTime: upcoming }), NOW)).toBe(false);
  });

  it('end-of-day sweep: a date-only pick from a prior day is expired', () => {
    expect(isPropExpired(mk({ gameDate: '2020-01-01' }), NOW)).toBe(true);
  });

  it('keeps a date-only pick whose date is still in the future', () => {
    expect(isPropExpired(mk({ gameDate: '2999-01-01' }), NOW)).toBe(false);
  });
});
