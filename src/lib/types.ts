// Pure view types shared by the server data layer and presentational components.
// No db/React/Next imports here, so components can import these freely.
import type {
  GameStatLine,
  StatKey,
  DvpCell,
  HitRateResult,
  Confidence,
  PosBucket,
  RecentFormEstimate,
  Consistency,
  MatchupGrade,
  FireFactorResult,
  PlayerSplits,
} from '@/lib/stats';
import type { Sport } from '@/lib/sports';

export interface PlayerSummary {
  sport: Sport;
  /** League PERSON_ID — used for the official headshot URL. */
  externalId: number;
  slug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  posBucket: PosBucket | null;
  jersey: string | null;
  height: string | null; // e.g. "6-6"
  weight: number | null; // lbs
  teamAbbreviation: string | null;
  teamName: string | null;
  /** League TEAM_ID for the current team — used for the team logo URL. */
  teamExternalId: number | null;
}

export interface PlayerListItem extends PlayerSummary {
  gamesPlayed: number;
}

/** A game line enriched with display context. */
export interface PlayerGame extends GameStatLine {
  gameDate: string;
  opponentTeamId: number;
  opponentAbbreviation: string;
  /** Opponent's league team id (for the logo). */
  opponentExternalId: number;
  isHome: boolean;
  wl: string | null;
  plusMinus: number | null;
}

export interface ChartPoint {
  gameDate: string;
  opponentAbbreviation: string;
  isHome: boolean;
  value: number;
  result: 'over' | 'under' | 'push';
  wl: string | null;
  plusMinus: number | null;
}

/** Player bio (from playerindex). Shown on the player page. */
export interface PlayerBio {
  college: string | null;
  country: string | null;
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
  fromYear: number | null;
}

export interface WindowResult {
  window: string;
  hitRate: HitRateResult;
  confidence: Confidence;
}

/** The "good prop" read for a player + stat + line (all on free data). */
export interface PlayerVerdict {
  /** Recent-form estimate range (raw L5/L10, EWMA, median, stabilized). */
  projection: RecentFormEstimate;
  consistency: Consistency;
  /** A-F matchup grade from DvP; null when there is no matchup. */
  matchupGrade: MatchupGrade | null;
  /** The composite FireFactor signal (LEAN mode — no user price). */
  fireScore: FireFactorResult;
}

/** One book's number for a player + stat, scored against the market consensus. */
export interface LineValueBook {
  source: string;
  line: number;
  /** Leaning-side hit rate at this book's line (season window), 0..1. */
  sideHitRate: number;
  /** sideHitRate − the consensus line's side hit rate: positive = a softer/better number. */
  edge: number;
}

/** Cross-book "where's the best number" comparison for a player + stat. */
export interface LineValueComparison {
  side: 'over' | 'under';
  /** Median line across the books. */
  consensusLine: number;
  books: LineValueBook[];
  /** The book with the clearly-best number (positive edge), or null. */
  best: { source: string; line: number; edge: number } | null;
}

export interface PlayerResearch {
  player: PlayerSummary;
  bio: PlayerBio;
  stat: StatKey;
  line: number;
  /** The book this line came from (e.g. "prizepicks"); null when it's our computed
   * line (no provided line for the chosen source, or the feature is off). */
  lineSource: string | null;
  /** Cross-book line-value comparison for this stat (null when <2 books / feature off). */
  lineValue: LineValueComparison | null;
  seasonAverage: number | null;
  gamesPlayed: number;
  /** ISO date (YYYY-MM-DD) of this player's most recent game; null if none. */
  lastGameDate: string | null;
  /** The FireFactor verdict + its sub-reads for this stat + line. */
  verdict: PlayerVerdict;
  /** Home/away + days-since-last-game splits for this stat + line. */
  splits: PlayerSplits;
  /** Last 20 games, most-recent-first, for the bar chart. */
  chart: ChartPoint[];
  windows: WindowResult[];
  /**
   * The opponent the matchup card + DvP are computed against: the player's next
   * scheduled game (or today's, if already started), falling back to the last
   * completed game off-season. `isUpcoming` distinguishes the two.
   */
  matchupOpponent: {
    teamId: number;
    abbreviation: string;
    isHome: boolean;
    /** Opponent's league team id (for the logo). */
    externalId: number;
    /** ISO date of the game this matchup is from. */
    date: string;
    /** Full ISO start datetime (UTC) for local-time display; null when unknown. */
    startTime: string | null;
    /** true = next/current scheduled game; false = last completed (off-season fallback). */
    isUpcoming: boolean;
  } | null;
  dvp: DvpCell | null;
  why: string;
}

/** One ranked row on the cross-player board. */
export interface BoardRow {
  /** Absolute FireFactor rank in the full board (stable under client filtering). */
  rank: number;
  player: PlayerListItem;
  stat: StatKey;
  statShort: string;
  line: number;
  /** Stabilized recent-form estimate (for the "recent X vs line Y" read). */
  projection: number | null;
  fireScore: FireFactorResult;
  /** Cross-book line value vs the consensus for THIS row's book; null when <2 books. */
  lineValue?: { edge: number; best: { source: string; line: number; edge: number } | null } | null;
}

/** One row on the trends board: how recent form has swung from the season baseline,
 *  with the player's current consecutive run (the merged "Streaks" metric) alongside. */
export interface TrendRow {
  rank: number;
  player: PlayerListItem;
  stat: StatKey;
  statShort: string;
  line: number;
  /** The recent-form side (the side the L10 leans). */
  side: 'over' | 'under';
  /** L10 hit rate on `side` (0..1). */
  recentRate: number;
  /** Wilson lower bound of the recent rate (the honest ranking key). */
  recentLower: number;
  /** Decided games in the recent window. */
  recentGames: number;
  /** Season hit rate on `side` (0..1). */
  seasonRate: number;
  /** recentRate − seasonRate, signed (the swing magnitude/direction). */
  delta: number;
  /** Current consecutive run for this stat+line (length ≥3), or null when there
   *  isn't one. Its side may differ from the L10 lean (a recent blip vs the trend). */
  streak: { side: 'over' | 'under'; length: number } | null;
}

/** One row on a defense-vs-position / pitching-allowed reference table. */
export interface DvpTableRow {
  rank: number;
  totalRanked: number;
  teamAbbreviation: string;
  teamName: string;
  teamExternalId: number;
  avgAllowed: number;
  sampleSize: number;
  lowSample: boolean;
  /** A–F matchup grade for a player facing this team (A = softest). */
  grade: MatchupGrade;
}

/** One row on a leaders-by-stat table. */
export interface LeaderRow {
  rank: number;
  player: PlayerListItem;
  /** Season per-game average of the stat. */
  perGame: number;
  gamesPlayed: number;
}

/** One analyzed line from a pasted slate (matched, or skipped with a reason). */
export interface SlateResult {
  raw: string;
  matched: boolean;
  /** Why an entry was skipped (when matched === false). */
  reason?: string;
  player?: PlayerSummary;
  stat?: StatKey;
  statShort?: string;
  line?: number;
  /** American odds the user supplied for the over (drives edge + EV). */
  odds?: number | null;
  fireScore?: FireFactorResult;
  /** Season over rate at the user's line. */
  overHitRate?: number | null;
  /** historical hit rate − price-implied prob (only with odds). */
  edge?: number | null;
  /** EV per $1 on the over vs the user's price (only with odds). */
  evPerDollar?: number | null;
}

/** One game on the "tonight" slate (from the free schedule feed). */
export interface TonightGame {
  externalId: string;
  /** ISO date (YYYY-MM-DD) of the game. */
  date: string;
  /** Full ISO start datetime (UTC) for local-time display; null when unknown. */
  startTime: string | null;
  status: string | null;
  home: { abbr: string | null; name: string | null; externalId: number | null };
  away: { abbr: string | null; name: string | null; externalId: number | null };
  homeProbablePitcher: string | null;
  awayProbablePitcher: string | null;
}
