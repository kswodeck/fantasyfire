// Pure view types shared by the server data layer and presentational components.
// No db/React/Next imports here, so components can import these freely.
import type {
  GameStatLine,
  StatKey,
  DvpCell,
  HitRateResult,
  Confidence,
  PosBucket,
} from '@/lib/stats';

export interface PlayerSummary {
  /** NBA PERSON_ID — used for the official headshot URL. */
  nbaId: number;
  slug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  posBucket: PosBucket | null;
  teamAbbreviation: string | null;
  teamName: string | null;
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
}

export interface ChartPoint {
  gameDate: string;
  opponentAbbreviation: string;
  isHome: boolean;
  value: number;
  result: 'over' | 'under' | 'push';
}

export interface WindowResult {
  window: string;
  hitRate: HitRateResult;
  confidence: Confidence;
}

export interface PlayerResearch {
  player: PlayerSummary;
  stat: StatKey;
  line: number;
  seasonAverage: number | null;
  gamesPlayed: number;
  /** Last 20 games, most-recent-first, for the bar chart. */
  chart: ChartPoint[];
  windows: WindowResult[];
  recentOpponent: { teamId: number; abbreviation: string; isHome: boolean } | null;
  dvp: DvpCell | null;
  why: string;
}
