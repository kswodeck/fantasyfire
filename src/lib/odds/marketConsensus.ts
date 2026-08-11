// Cross-book market consensus — the automated "+EV vs the market" core (idea #1).
//
// We already scrape two-sided American odds for a prop from several sportsbooks
// (DraftKings/FanDuel/BetMGM/Caesars/Hard Rock/BetRivers via RotoWire). This turns
// that into the numbers a sharp bettor actually uses:
//   - the NO-VIG consensus probability (de-vig each book at the line, take the median
//     — a poor-man's "sharp line" that the books' margins are removed from), and
//   - the BEST available price for each side, plus the +EV of that price vs consensus.
//
// Pure (no React/Next/db). Builds on the per-book de-vig math in fairPrice.ts. We only
// compare books quoting the SAME line — odds at different lines aren't commensurable.
import { americanToImplied, deVigTwoWay, evPerDollar, isAmericanOdds } from './fairPrice';

/** One book's quote for a prop (a single line + optional two-sided American odds). */
export interface BookQuote {
  source: string;
  line: number;
  overOdds: number | null;
  underOdds: number | null;
}

export interface BestPrice {
  source: string;
  odds: number;
  /** EV per $1 at this price vs the no-vig consensus probability (null w/o consensus). */
  evPerDollar: number | null;
}

export interface MarketConsensus {
  /** The line the consensus is computed at (the modal line across two-sided books). */
  line: number;
  /** How many books contributed a two-sided quote at that line. */
  bookCount: number;
  /** No-vig consensus P(over) — median of per-book de-vigged over probs. Null if none. */
  fairProbOver: number | null;
  fairProbUnder: number | null;
  /** Best (highest-payout) price available for each side at the line. */
  bestOver: BestPrice | null;
  bestUnder: BestPrice | null;
}

const SAME_LINE_EPS = 1e-9;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** No-vig fair P(over) from one book's two-sided odds; null if either side is missing
 *  or isn't really American odds (a decimal payout in an "over"/"under" field would
 *  otherwise cast a garbage vote into the consensus median — and this consensus is
 *  what every OTHER book's variant rungs get their market-implied breakeven from,
 *  so one mislabelled feed must not be able to move everyone's bar). */
export function noVigOver(overOdds: number | null, underOdds: number | null): number | null {
  if (!isAmericanOdds(overOdds) || !isAmericanOdds(underOdds)) return null;
  const dv = deVigTwoWay(americanToImplied(overOdds), americanToImplied(underOdds));
  return dv.fairOver;
}

/**
 * The modal line among books quoting two-sided odds (the "market line"). Ties break
 * to the line nearest `preferredLine` when given, else the lowest. Null if no book
 * has two-sided odds.
 */
function marketLine(quotes: BookQuote[], preferredLine?: number): number | null {
  const counts = new Map<number, number>();
  for (const q of quotes) {
    // Only quotes we can actually de-vig count as votes — otherwise a book whose
    // "odds" aren't American could carry a line to modal and then contribute no
    // probability there, leaving the consensus null at a line nobody really quotes.
    if (isAmericanOdds(q.overOdds) && isAmericanOdds(q.underOdds)) {
      counts.set(q.line, (counts.get(q.line) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  let best: { line: number; count: number } | null = null;
  for (const [line, count] of counts) {
    if (
      !best ||
      count > best.count ||
      (count === best.count &&
        preferredLine != null &&
        Math.abs(line - preferredLine) < Math.abs(best.line - preferredLine)) ||
      (count === best.count && preferredLine == null && line < best.line)
    ) {
      best = { line, count };
    }
  }
  return best?.line ?? null;
}

/**
 * Build the market consensus for a prop from every book's quote. When `preferredLine`
 * is given (e.g. the line the user is viewing), ties in the modal line prefer it.
 */
export function marketConsensus(
  quotes: BookQuote[],
  preferredLine?: number,
): MarketConsensus | null {
  const line = marketLine(quotes, preferredLine);
  if (line === null) return null;

  const atLine = quotes.filter((q) => Math.abs(q.line - line) < SAME_LINE_EPS);
  const overProbs: number[] = [];
  for (const q of atLine) {
    const p = noVigOver(q.overOdds, q.underOdds);
    if (p != null) overProbs.push(p);
  }
  const fairProbOver = overProbs.length ? median(overProbs) : null;
  const fairProbUnder = fairProbOver == null ? null : 1 - fairProbOver;

  const bestOver = bestPrice(atLine, 'over', fairProbOver);
  const bestUnder = bestPrice(atLine, 'under', fairProbUnder);

  return {
    line,
    bookCount: overProbs.length,
    fairProbOver,
    fairProbUnder,
    bestOver,
    bestUnder,
  };
}

/** Highest-payout price for a side among the given quotes, with its EV vs `fairProb`. */
function bestPrice(
  quotes: BookQuote[],
  side: 'over' | 'under',
  fairProb: number | null,
): BestPrice | null {
  let best: { source: string; odds: number } | null = null;
  for (const q of quotes) {
    const odds = side === 'over' ? q.overOdds : q.underOdds;
    // "Higher pays more" only holds on the American scale — an un-validated decimal
    // payout (1.90) beats every real price here (1.90 > −110) and would be crowned
    // best price at a wildly wrong EV. Reject it rather than rank it.
    if (!isAmericanOdds(odds)) continue;
    // Higher American odds always pay more for the same $1 stake (+150 > +120 > −110 > −130).
    if (!best || odds > best.odds) best = { source: q.source, odds };
  }
  if (!best) return null;
  return {
    ...best,
    evPerDollar: fairProb == null ? null : evPerDollar(fairProb, best.odds),
  };
}
