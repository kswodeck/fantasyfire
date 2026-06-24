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
  /** Last 20 games, most-recent-first, for the bar chart. */
  chart: ChartPoint[];
  windows: WindowResult[];
  recentOpponent: { teamId: number; abbreviation: string; isHome: boolean } | null;
  dvp: DvpCell | null;
  why: string;
}
