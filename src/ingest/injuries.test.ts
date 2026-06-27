import { describe, it, expect } from 'vitest';
import { normalizeInjuryStatus } from './injuries';

describe('normalizeInjuryStatus', () => {
  it('maps IL / suspension / paternity to out', () => {
    for (const s of ['60-Day-IL', '15-Day-IL', '10-Day-IL', '7-Day IL', 'Out', 'suspension', 'paternity', 'developmental list']) {
      expect(normalizeInjuryStatus(s)).toBe('out');
    }
  });
  it('maps the game-time-decision tiers', () => {
    expect(normalizeInjuryStatus('Doubtful')).toBe('doubtful');
    expect(normalizeInjuryStatus('Questionable')).toBe('questionable');
    expect(normalizeInjuryStatus('Day-To-Day')).toBe('day-to-day');
  });
});
