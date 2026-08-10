import { describe, it, expect } from 'vitest';
import { parseRwBody, type RwResponse } from './rotowire';
import type { ProvidedLineRow } from './providedTypes';
import { sidedBreakevens } from '../lib/payoutVariant';

// The RotoWire payload mixes sportsbooks (American odds) with pick'em products
// (payout multipliers) in the same `over`/`under` fields. Storing a multiplier as
// odds is silently catastrophic downstream — see the breakeven assertions at the
// bottom — so the parser validates every price before it keeps one.

/** A one-prop payload where each entry of `lines` is a book's quote for that prop. */
function body(lines: Array<{ book: string; over?: number | null; under?: number | null }>): RwResponse {
  return {
    entities: [{ entityID: 77, eventID: 5, sport: 'MLB', name: 'Test Batter' }],
    markets: [{ marketID: 10, category: 'Game', marketName: 'Hits' }],
    events: [{ eventID: 5, eventTime: 1_784_000_000 }],
    props: [{ marketID: 10, entities: [77], lines: lines.map((l) => ({ ...l, line: 1.5 })) }],
  };
}

function parse(b: RwResponse): ProvidedLineRow[] {
  const out: ProvidedLineRow[] = [];
  parseRwBody(b, out);
  return out;
}

describe('rotowire price validation', () => {
  it('keeps real American odds from a sportsbook', () => {
    const [row] = parse(body([{ book: 'draftkings-sb', over: -115, under: -105 }]));
    expect(row.source).toBe('draftkings');
    expect(row.overOdds).toBe(-115);
    expect(row.underOdds).toBe(-105);
  });

  it('keeps +100/-100 — the shortest price the American scale can express', () => {
    const [row] = parse(body([{ book: 'fanduel-sb', over: 100, under: -100 }]));
    expect(row.overOdds).toBe(100);
    expect(row.underOdds).toBe(-100);
  });

  it('drops a decimal payout quoted in the odds fields, and KEEPS the line', () => {
    // A pick'em book quoting 1.90× per side. The prop is still real and worth
    // scoring — it just has no odds we can read, so it anchors at a flat 0.5.
    const rows = parse(body([{ book: 'rtsports', over: 1.9, under: 1.9 }]));
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('rtsports');
    expect(rows[0].line).toBe(1.5);
    expect(rows[0].overOdds).toBeNull();
    expect(rows[0].underOdds).toBeNull();
  });

  it('validates each side independently', () => {
    const [row] = parse(body([{ book: 'betmgm-sb', over: -120, under: 0.5 }]));
    expect(row.overOdds).toBe(-120);
    expect(row.underOdds).toBeNull();
  });

  it('drops a missing/garbage price without dropping the book', () => {
    const [row] = parse(body([{ book: 'caesars-sb', over: null, under: undefined }]));
    expect(row.source).toBe('caesars');
    expect(row.overOdds).toBeNull();
    expect(row.underOdds).toBeNull();
  });

  it('counts the books whose prices it rejected, for the run log', () => {
    const out: ProvidedLineRow[] = [];
    const dropped = new Map<string, number>();
    parseRwBody(
      body([
        { book: 'rtsports', over: 1.9, under: 1.9 },
        { book: 'draftkings-sb', over: -110, under: -110 },
      ]),
      out,
      dropped,
    );
    expect(dropped.get('rtsports')).toBe(1);
    expect(dropped.has('draftkings')).toBe(false);
  });

  it('why it matters: a decimal payout read as odds implies an impossible bar', () => {
    // The regression this guards. Both sides of a 1.90× pick'em price look like ~98%
    // implied probability on the American scale, so the rung's breakeven clamps to
    // 0.95 — a bar no real hit rate clears, which drops the book's ENTIRE board below
    // the Heat Check's no-read cutoff while the book still shows in the selector.
    expect(sidedBreakevens({ overOdds: 1.9, underOdds: 1.9 })).toBeNull();
    // A genuine -110/-110 pair still prices normally (the ~52.4% vig-inclusive bar).
    const real = sidedBreakevens({ overOdds: -110, underOdds: -110 });
    expect(real!.over).toBeCloseTo(0.524, 3);
    expect(real!.under).toBeCloseTo(0.524, 3);
  });
});
