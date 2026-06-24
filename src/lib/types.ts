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
  FireScoreResult,
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
  /** The composite FireScore signal (LEAN mode — no user price). */
  fireScore: FireScoreResult;
}

export interface PlayerResearch {
  player: PlayerSummary;
  bio: PlayerBio;
  stat: StatKey;
  line: number;
  seasonAverage: number | null;
  gamesPlayed: number;
  /** ISO date (YYYY-MM-DD) of this player's most recent game; null if none. */
  lastGameDate: string | null;
  /** The FireScore verdict + its sub-reads for this stat + line. */
  verdict: PlayerVerdict;
  /** Home/away + days-since-last-game splits for this stat + line. */
  splits: PlayerSplits;
  /** Last 20 games, most-recent-first, for the bar chart. */
  chart: ChartPoint[];
  windows: WindowResult[];
  recentOpponent: {
    teamId: number;
    abbreviation: string;
    isHome: boolean;
    /** Opponent's league team id (for the logo). */
    externalId: number;
    /** ISO date of the game this matchup is from. */
    date: string;
  } | null;
  dvp: DvpCell | null;
  why: string;
}

/** One ranked row on the cross-player board. */
export interface BoardRow {
  /** Absolute FireScore rank in the full board (stable under client filtering). */
  rank: number;
  player: PlayerListItem;
  stat: StatKey;
  statShort: string;
  line: number;
  /** Stabilized recent-form estimate (for the "recent X vs line Y" read). */
  projection: number | null;
  fireScore: FireScoreResult;
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
  fireScore?: FireScoreResult;
  /** Season over rate at the user's line. */
  overHitRate?: number | null;
  /** historical hit rate − price-implied prob (only with odds). */
  edge?: number | null;
  /** EV per $1 on the over vs the user's price (only with odds). */
  evPerDollar?: number | null;
}

/** One row of the /accuracy calibration: how a FireScore tier actually fared. */
export interface CalibrationBucket {
  label: string;
  /** Graded predictions in this tier (pushes excluded). */
  decided: number;
  /** Predictions where the leaned side actually won. */
  wins: number;
  winRate: number | null;
  /** 95% Wilson interval on the win rate. */
  lower: number;
  upper: number;
}

export interface Calibration {
  /** Total graded leans (pushes excluded). */
  totalGraded: number;
  overallWinRate: number | null;
  /** ISO date of the earliest graded prediction. */
  trackingSince: string | null;
  buckets: CalibrationBucket[];
}

/** One game on the "tonight" slate (from the free schedule feed). */
export interface TonightGame {
  externalId: string;
  /** ISO date (YYYY-MM-DD) of the game. */
  date: string;
  status: string | null;
  home: { abbr: string | null; name: string | null; externalId: number | null };
  away: { abbr: string | null; name: string | null; externalId: number | null };
  homeProbablePitcher: string | null;
  awayProbablePitcher: string | null;
}
