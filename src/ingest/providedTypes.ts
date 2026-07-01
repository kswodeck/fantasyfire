// Shared shape produced by every provided-line source (PrizePicks, Underdog, the
// RotoWire aggregator, …) and consumed by run-ingest-providedlines.ts. Kept provider-
// neutral so each client file depends on this, not on each other.
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';

/** One real line for a player + stat from a single source/book. */
export interface ProvidedLineRow {
  sport: Sport;
  /** Source id, e.g. "prizepicks" | "underdog" | "fanduel". */
  source: string;
  /** The source's own player id (debug / future exact match). */
  externalPlayerId: string;
  /** Display name used to match our Player rows. */
  externalPlayerName: string;
  stat: StatKey;
  line: number;
  /** American odds for over/under when the source posts them (DFS pick'em often null). */
  overOdds: number | null;
  underOdds: number | null;
  /**
   * Payout variant tag. PrizePicks: "standard" | "goblin" | "demon". Underdog:
   * "balanced" | "alternate". Omitted/null for books with no variant concept.
   */
  oddsType?: string | null;
  /**
   * Exact payout multiplier when the source exposes one (Underdog: 1.0 balanced,
   * e.g. 1.31 alternate). null/omitted when unavailable — PrizePicks never ships a
   * per-line number, sportsbooks price via odds instead.
   */
  multiplier?: number | null;
  /** Date-only (UTC midnight) the line applies to. */
  gameDate: Date;
}
