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
  FireSide,
  FireTier,
  PlayerSplits,
} from '@/lib/stats';
import type { MarketConsensus } from '@/lib/odds';
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

/** Slim availability for the small injury badge on list rows / cards — a subset of
 *  PlayerAvailability that's cheap to batch-load alongside a roster. */
export interface CardAvailability {
  status: PlayerAvailability['status'];
  fantasyStatus: string | null;
  detail: string | null;
  returnDate: string | null;
}

export interface PlayerListItem extends PlayerSummary {
  gamesPlayed: number;
  /** Current injury designation for the row badge; absent/null when the player is clear. */
  availability?: CardAvailability | null;
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
  /** Matchup-adjusted projection (raw L5/L10, EWMA, median, base + adjusted). */
  projection: RecentFormEstimate;
  consistency: Consistency;
  /** A-F matchup grade from DvP; null when there is no matchup. */
  matchupGrade: MatchupGrade | null;
  /** The composite FireFactor signal. */
  fireScore: FireFactorResult;
  /** Model P(stat > line) from the projection's distribution; null when no projection. */
  modelProbOver: number | null;
  /** Cross-book no-vig consensus + best price / +EV; null when <1 two-sided book. */
  marketConsensus: MarketConsensus | null;
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

/**
 * One rung of a source's payout-variant ladder for a player + stat. A single source
 * may expose several (PrizePicks demon/goblin ladders, Underdog alternates); see
 * src/lib/payoutVariant.ts for the kind normalization + representative-rung pick.
 */
export interface ProvidedVariant {
  source: string;
  line: number;
  /** Raw tag: "standard"|"goblin"|"demon" (PP), "balanced"|"alternate" (UD), or null. */
  oddsType: string | null;
  /** Exact payout multiplier when the source ships one (UD alternates); else null. */
  multiplier: number | null;
  overOdds: number | null;
  underOdds: number | null;
  /** Server-computed FireFactor at THIS rung, calibrated vs the rung's payout
   *  breakeven — powers instant chip switches, per-rung ladder scores, and
   *  value-aware filtering. Present on player-research + sourced-board payloads;
   *  absent on trend rows (their metric is the form swing, not the score). */
  read?: { side: FireSide; score: number; tier: FireTier } | null;
}

export interface PlayerResearch {
  player: PlayerSummary;
  bio: PlayerBio;
  stat: StatKey;
  line: number;
  /** The book this line came from (e.g. "prizepicks"); null when it's our computed
   * line (no provided line for the chosen source, or the feature is off). */
  lineSource: string | null;
  /** Payout tag of the current line, when it came from a source variant (goblin/
   *  demon/alternate); null for a plain line or our computed line. */
  oddsType: string | null;
  /** Exact payout multiplier of the current line (UD alternates); null when none. */
  multiplier: number | null;
  /** The selected source's full variant ladder for this stat — powers the on-page
   *  ladder/switcher. Empty when the feature is off or the source has no lines. */
  variants: ProvidedVariant[];
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
    /** The scheduled game's external id (links to /[sport]/game/[id]); null for the
     *  off-season last-completed-game fallback. */
    gameExternalId: string | null;
    /** true = next/current scheduled game; false = last completed (off-season fallback). */
    isUpcoming: boolean;
  } | null;
  dvp: DvpCell | null;
  /** Current injury / availability status (idea #5); null when the player is clear. */
  availability: PlayerAvailability | null;
  /** How this player's line shifts when an impactful teammate is OUT (injury cascade). */
  teammateSplits: TeammateSplit[];
  why: string;
}

/** Current injury / availability for a player, from the ESPN injuries feed. */
export interface PlayerAvailability {
  /** Normalized bucket: out | doubtful | questionable | day-to-day. */
  status: 'out' | 'doubtful' | 'questionable' | 'day-to-day';
  /** ESPN's original status string (e.g. "15-Day-IL"). */
  rawStatus: string;
  /** Finer fantasy designation — "GTD", "Probable", "15-Day IL" — when given. */
  fantasyStatus: string | null;
  /** Assembled injury, e.g. "Right Ankle Sprain", when given. */
  detail: string | null;
  /** Estimated return date (ISO YYYY-MM-DD), when given. */
  returnDate: string | null;
  /** ESPN's short comment, when given. */
  comment: string | null;
  /** ESPN's longer beat-writer note, when given. */
  news: string | null;
}

/** A player's stat line split by whether an OUT teammate was playing — the injury
 *  "cascade" read (live injuries × our box scores). */
export interface TeammateSplit {
  /** The out teammate's name. */
  name: string;
  /** Their status designation (GTD / Out / IL tier), when given. */
  fantasyStatus: string | null;
  /** Their injury, e.g. "Left Knee Soreness", when given. */
  detail: string | null;
  /** This player's line in games the teammate was OUT. */
  without: { games: number; mean: number | null; hitRateOver: number | null };
  /** This player's line in games the teammate PLAYED. */
  withTeammate: { games: number; mean: number | null; hitRateOver: number | null };
}

/** One row on the per-sport injury report page. */
export interface InjuryReportRow {
  slug: string;
  name: string;
  team: string | null;
  position: string | null;
  status: PlayerAvailability['status'];
  fantasyStatus: string | null;
  detail: string | null;
  returnDate: string | null;
  comment: string | null;
}

/** One ranked row on the cross-player board. */
export interface BoardRow {
  /** Absolute FireFactor rank in the full board (stable under client filtering). */
  rank: number;
  player: PlayerListItem;
  stat: StatKey;
  statShort: string;
  line: number;
  /** Matchup-adjusted projection (for the "recent X vs line Y" read). */
  projection: number | null;
  fireScore: FireFactorResult;
  /** Cross-book line value vs the consensus for THIS row's book; null when <2 books. */
  lineValue?: { edge: number; best: { source: string; line: number; edge: number } | null } | null;
  /** Payout tag of the representative rung shown (goblin/demon/alternate); null = plain line. */
  oddsType?: string | null;
  /** Exact payout multiplier of the shown rung (UD alternates); null when none. */
  multiplier?: number | null;
  /** This source's full variant ladder for the stat — powers the row's icon switcher.
   *  Present only on the sourced (per-book) boards; omitted on the computed board. */
  variants?: ProvidedVariant[];
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
  /** Payout tag of the line the trend was computed against (goblin/demon/alternate);
   *  null = plain line. Present only on the sourced (per-book) trends. */
  oddsType?: string | null;
  /** Exact payout multiplier of that line (UD alternates); null when none. */
  multiplier?: number | null;
  /** This source's full variant ladder for the stat — powers the kind filter. */
  variants?: ProvidedVariant[];
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
