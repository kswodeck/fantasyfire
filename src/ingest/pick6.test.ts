import { describe, it, expect } from 'vitest';
import { parseCategory, type P6CategoryResponse } from './pick6';
import type { ProvidedLineRow } from './providedTypes';

// Regression suite for the standard/alternate classification: only a rung that
// sells BOTH More and Less is 'standard'; every More-only rung — including the
// one DK highlights as the card's default (frequently a 0.7× or 2.4× special) —
// is an 'alternate' carrying its exact multiplier.

const MORE = 1;
const LESS = 2;

function category(): P6CategoryResponse {
  return {
    entityInfoByDkId: { '77': { fullName: 'Test Batter' } },
    pickSixMarketById: { '10': { name: 'Hits' }, '11': { name: 'Hits + Runs + RBIs' } },
    competitionById: { '5': { startTime: '2026-07-19T22:10:00Z' } },
    pickCardByPickableId: {
      card1: {
        entities: [{ dkId: 77, compIds: [5] }],
        activePickableMarkets: [
          // DK's highlighted default: More-only at a REDUCED 0.7× payout.
          {
            pickableMarketId: 1,
            pickSixMarketId: 10,
            targetValue: 0.5,
            activeSelections: [{ statLinePropositionId: MORE, standingsMultiplier: 0.7 }],
          },
          // The true two-sided line (More + Less, ~1× both ways).
          {
            pickableMarketId: 2,
            pickSixMarketId: 10,
            targetValue: 1.5,
            activeSelections: [
              { statLinePropositionId: MORE, standingsMultiplier: 1 },
              { statLinePropositionId: LESS, standingsMultiplier: 1 },
            ],
          },
          // A boosted More-only rung (demon-like).
          {
            pickableMarketId: 3,
            pickSixMarketId: 11,
            targetValue: 3.5,
            activeSelections: [{ statLinePropositionId: MORE, standingsMultiplier: 2.4 }],
          },
          // Paused rungs never emit rows.
          {
            pickableMarketId: 4,
            pickSixMarketId: 10,
            targetValue: 2.5,
            isPaused: true,
            activeSelections: [{ statLinePropositionId: MORE, standingsMultiplier: 1.4 }],
          },
        ],
      },
    },
  };
}

describe('parseCategory (Pick6 standard/alternate classification)', () => {
  const rows: ProvidedLineRow[] = [];
  parseCategory('mlb', category(), rows);
  const byLine = (line: number, stat: string) =>
    rows.find((r) => r.line === line && r.stat === stat)!;

  it('emits one row per live priced rung', () => {
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source === 'pick6' && r.externalPlayerName === 'Test Batter')).toBe(
      true,
    );
  });

  it('a More-only rung is an alternate with its exact multiplier — even the 0.5 default', () => {
    const reduced = byLine(0.5, 'hits');
    expect(reduced.oddsType).toBe('alternate');
    expect(reduced.multiplier).toBe(0.7);
    const boosted = byLine(3.5, 'hrr');
    expect(boosted.oddsType).toBe('alternate');
    expect(boosted.multiplier).toBe(2.4);
  });

  it('a two-sided (More + Less) rung is the standard line with no multiplier', () => {
    const std = byLine(1.5, 'hits');
    expect(std.oddsType).toBe('standard');
    expect(std.multiplier).toBeNull();
  });

  it('never emits two-sided odds — Pick6 prices via multipliers', () => {
    expect(rows.every((r) => r.overOdds === null && r.underOdds === null)).toBe(true);
  });
});
