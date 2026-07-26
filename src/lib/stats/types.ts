// Framework-agnostic stat model (no React/Next/Prisma imports) so the whole
// compute core ports unchanged. Multi-sport: one superset GameStatLine + one
// combined STAT_DEFS registry; each sport exposes its own ordered key list.
import type { Sport } from '@/lib/sports';
import { roundToHundredth } from '@/lib/format';

const n = (x: number | null | undefined): number => x ?? 0;

/**
 * A single game's box-score line. All stat fields are optional — a game only
 * populates its sport's columns; value extractors coalesce missing to 0.
 */
export interface GameStatLine {
  // NBA box score
  points?: number | null;
  rebounds?: number | null;
  oreb?: number | null;
  dreb?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  fouls?: number | null;
  fgm?: number | null;
  fga?: number | null;
  fg3m?: number | null;
  fg3a?: number | null;
  ftm?: number | null;
  fta?: number | null;
  // MLB hitting
  atBats?: number | null;
  hits?: number | null;
  doubles?: number | null;
  triples?: number | null;
  homeRuns?: number | null;
  runs?: number | null;
  rbi?: number | null;
  walks?: number | null;
  strikeouts?: number | null;
  stolenBases?: number | null;
  totalBases?: number | null;
  hbp?: number | null;
  // MLB pitching
  outs?: number | null;
  hitsAllowed?: number | null;
  runsAllowed?: number | null;
  earnedRuns?: number | null;
  walksAllowed?: number | null;
  strikeoutsPitched?: number | null;
  // NFL
  passYards?: number | null;
  passTds?: number | null;
  passCompletions?: number | null;
  passAttempts?: number | null;
  passInts?: number | null;
  rushYards?: number | null;
  rushAttempts?: number | null;
  rushTds?: number | null;
  receptions?: number | null;
  targets?: number | null;
  recYards?: number | null;
  recTds?: number | null;
  fumblesLost?: number | null;
  // NHL skaters (goals/saves/goalsAgainst/shotsAgainst shared with soccer;
  // assists/points/minutes/plusMinus shared with the NBA columns)
  goals?: number | null;
  shotsOnGoal?: number | null;
  hitsDelivered?: number | null;
  blockedShots?: number | null;
  faceoffsWon?: number | null;
  // NHL goalies / soccer goalkeepers
  saves?: number | null;
  goalsAgainst?: number | null;
  shotsAgainst?: number | null;
  // Soccer (MLS) — fouls committed reuses the shared `fouls` column
  shots?: number | null;
  shotsOnTarget?: number | null;
  // Optional context for display / charts.
  minutes?: number | null;
  gameDate?: string;
  opponentAbbreviation?: string;
  isHome?: boolean;
}

/** Position buckets. NBA/WNBA: G/F/C (DvP). MLB: H/P. NFL: QB/RB/WR/TE.
 *  NHL: F/D/G (G = goalie). Soccer (MLS): F/M/D/G (G = goalkeeper).
 *  Letters are shared across sports — the meaning is always sport-scoped. */
export type PosBucket = 'G' | 'F' | 'C' | 'H' | 'P' | 'QB' | 'RB' | 'WR' | 'TE' | 'D' | 'M';

/** All researchable stat keys across sports (kept unique so one registry works). */
export type StatKey =
  // NBA
  | 'pts'
  | 'reb'
  | 'oreb'
  | 'dreb'
  | 'ast'
  | 'fg3m'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'fouls'
  | 'pra'
  | 'pr'
  | 'pa'
  | 'ra'
  | 'stocks'
  | 'fs'
  // MLB hitting
  | 'hits'
  | 'tb'
  | 'hr'
  | 'rbi'
  | 'runs'
  | 'sb'
  | 'bb'
  | 'so'
  | 'doubles'
  | 'hrr'
  | 'hitterFs'
  // MLB pitching
  | 'k'
  | 'er'
  | 'outs'
  | 'ha'
  | 'bba'
  // NFL — passing
  | 'passYds'
  | 'passTds'
  | 'passCmp'
  | 'passAtt'
  | 'ints'
  // NFL — rushing
  | 'rushYds'
  | 'carries'
  | 'rushTds'
  // NFL — receiving
  | 'rec'
  | 'targets'
  | 'recYds'
  | 'recTds'
  // NFL — misc
  | 'fumbles'
  | 'fantasyScore'
  // NHL — skaters ('pts' and 'ast' are shared with the NBA defs; NHL rows store
  // points = goals + assists in the shared `points` column)
  | 'goals'
  | 'sog'
  | 'nhlHits'
  | 'blocked'
  | 'fow'
  // NHL goalies / soccer goalkeepers (shared)
  | 'saves'
  | 'ga'
  | 'sa'
  // Soccer (MLS) — 'goals' and 'ast' shared
  | 'shots'
  | 'sot'
  | 'foulsCommitted';

export interface StatDef {
  key: StatKey;
  /** The stat's canonical sport (labels/tests). Keys can be SHARED across sports —
   *  which sport offers which keys is defined by statKeysForSport, not this field
   *  (WNBA reuses the NBA keys; NHL and soccer share the goalie keys). */
  sport: Sport;
  label: string;
  short: string;
  value: (g: GameStatLine) => number;
}

// ---- Fantasy Score (PrizePicks scoring) ---------------------------------------
// Historical per-game fantasy points computed from the stored box scores, so FS
// props get the same hit rates / windows / FireFactor as any counting stat. These
// are PRIZEPICKS' published scoring tables — hand-maintained editorial data, same
// contract as PP_BREAKEVEN_STEPS (ppPayouts.ts): VERIFY against the PrizePicks app
// when updating; other books score fantasy differently, so ONLY PrizePicks FS
// markets map onto these keys (see PP_STAT_MAP) — never another book's FS line.
//
//   NBA:  PTS ×1 · REB ×1.2 · AST ×1.5 · STL ×3 · BLK ×3 · TOV ×(−1)
//   MLB (hitter): 1B ×3 · 2B ×5 · 3B ×8 · HR ×10 · R ×2 · RBI ×2 · BB ×2 ·
//                 HBP ×2 · SB ×5  (singles derived: H − 2B − 3B − HR)
//   NFL:  pass yds ×0.04 · pass TD ×4 · INT ×(−1) · rush/rec yds ×0.1 ·
//         rush/rec TD ×6 · reception ×1 · fumble lost ×(−2)
//         (2-pt conversions aren't in our box scores — omitted, a rare rounding)
//
// MLB pitcher FS is deliberately absent: PrizePicks scores it on the pitching WIN
// (a decision we don't store), so we can't compute honest historical values.
// Each score is rounded to the hundredth: the fractional weights below are exact
// in decimal but not in binary, so a raw sum surfaces artifacts like
// 0.19999999999999996 (1 REB ×1.2 − 1 TOV). No weight has more than two decimals,
// so this only removes the artifact — it never discards a real digit.
export function nbaFantasyScore(g: GameStatLine): number {
  return roundToHundredth(
    n(g.points) +
      1.2 * n(g.rebounds) +
      1.5 * n(g.assists) +
      3 * n(g.steals) +
      3 * n(g.blocks) -
      n(g.turnovers),
  );
}
export function mlbHitterFantasyScore(g: GameStatLine): number {
  // Clamped so a data oddity (extra-base hits exceeding hits) can't go negative.
  const singles = Math.max(0, n(g.hits) - n(g.doubles) - n(g.triples) - n(g.homeRuns));
  // Whole-number weights here, so this is already exact — rounded anyway to keep
  // every fantasy-score key on one contract.
  return roundToHundredth(
    3 * singles +
      5 * n(g.doubles) +
      8 * n(g.triples) +
      10 * n(g.homeRuns) +
      2 * n(g.runs) +
      2 * n(g.rbi) +
      2 * n(g.walks) +
      2 * n(g.hbp) +
      5 * n(g.stolenBases),
  );
}
export function nflFantasyScore(g: GameStatLine): number {
  // 0.04/0.1 per yard on whole-yard counts — two decimals at most, so the round
  // is pure artifact cleanup (e.g. 0.04 × 3 = 0.12000000000000001).
  return roundToHundredth(
    0.04 * n(g.passYards) +
      4 * n(g.passTds) -
      n(g.passInts) +
      0.1 * n(g.rushYards) +
      6 * n(g.rushTds) +
      n(g.receptions) +
      0.1 * n(g.recYards) +
      6 * n(g.recTds) -
      2 * n(g.fumblesLost),
  );
}

export const STAT_DEFS: Record<StatKey, StatDef> = {
  // ---- NBA ----
  pts: { key: 'pts', sport: 'nba', label: 'Points', short: 'PTS', value: (g) => n(g.points) },
  reb: { key: 'reb', sport: 'nba', label: 'Rebounds', short: 'REB', value: (g) => n(g.rebounds) },
  oreb: { key: 'oreb', sport: 'nba', label: 'Offensive Rebounds', short: 'OREB', value: (g) => n(g.oreb) },
  dreb: { key: 'dreb', sport: 'nba', label: 'Defensive Rebounds', short: 'DREB', value: (g) => n(g.dreb) },
  ast: { key: 'ast', sport: 'nba', label: 'Assists', short: 'AST', value: (g) => n(g.assists) },
  fg3m: { key: 'fg3m', sport: 'nba', label: '3-Pointers Made', short: '3PM', value: (g) => n(g.fg3m) },
  stl: { key: 'stl', sport: 'nba', label: 'Steals', short: 'STL', value: (g) => n(g.steals) },
  blk: { key: 'blk', sport: 'nba', label: 'Blocks', short: 'BLK', value: (g) => n(g.blocks) },
  tov: { key: 'tov', sport: 'nba', label: 'Turnovers', short: 'TOV', value: (g) => n(g.turnovers) },
  fouls: { key: 'fouls', sport: 'nba', label: 'Personal Fouls', short: 'PF', value: (g) => n(g.fouls) },
  pra: { key: 'pra', sport: 'nba', label: 'Points + Rebounds + Assists', short: 'PRA', value: (g) => n(g.points) + n(g.rebounds) + n(g.assists) },
  pr: { key: 'pr', sport: 'nba', label: 'Points + Rebounds', short: 'PR', value: (g) => n(g.points) + n(g.rebounds) },
  pa: { key: 'pa', sport: 'nba', label: 'Points + Assists', short: 'PA', value: (g) => n(g.points) + n(g.assists) },
  ra: { key: 'ra', sport: 'nba', label: 'Rebounds + Assists', short: 'RA', value: (g) => n(g.rebounds) + n(g.assists) },
  stocks: { key: 'stocks', sport: 'nba', label: 'Steals + Blocks', short: 'STOCKS', value: (g) => n(g.steals) + n(g.blocks) },
  fs: { key: 'fs', sport: 'nba', label: 'Fantasy Score (PrizePicks)', short: 'FS', value: nbaFantasyScore },

  // ---- MLB hitting ----
  hits: { key: 'hits', sport: 'mlb', label: 'Hits', short: 'H', value: (g) => n(g.hits) },
  tb: { key: 'tb', sport: 'mlb', label: 'Total Bases', short: 'TB', value: (g) => n(g.totalBases) },
  hr: { key: 'hr', sport: 'mlb', label: 'Home Runs', short: 'HR', value: (g) => n(g.homeRuns) },
  rbi: { key: 'rbi', sport: 'mlb', label: 'RBIs', short: 'RBI', value: (g) => n(g.rbi) },
  runs: { key: 'runs', sport: 'mlb', label: 'Runs', short: 'R', value: (g) => n(g.runs) },
  sb: { key: 'sb', sport: 'mlb', label: 'Stolen Bases', short: 'SB', value: (g) => n(g.stolenBases) },
  bb: { key: 'bb', sport: 'mlb', label: 'Walks', short: 'BB', value: (g) => n(g.walks) },
  so: { key: 'so', sport: 'mlb', label: 'Strikeouts (batter)', short: 'SO', value: (g) => n(g.strikeouts) },
  doubles: { key: 'doubles', sport: 'mlb', label: 'Doubles', short: '2B', value: (g) => n(g.doubles) },
  hrr: { key: 'hrr', sport: 'mlb', label: 'Hits + Runs + RBIs', short: 'H+R+RBI', value: (g) => n(g.hits) + n(g.runs) + n(g.rbi) },
  hitterFs: { key: 'hitterFs', sport: 'mlb', label: 'Hitter Fantasy Score (PrizePicks)', short: 'FS', value: mlbHitterFantasyScore },

  // ---- MLB pitching ----
  k: { key: 'k', sport: 'mlb', label: 'Strikeouts (pitcher)', short: 'K', value: (g) => n(g.strikeoutsPitched) },
  er: { key: 'er', sport: 'mlb', label: 'Earned Runs', short: 'ER', value: (g) => n(g.earnedRuns) },
  outs: { key: 'outs', sport: 'mlb', label: 'Outs Recorded', short: 'OUTS', value: (g) => n(g.outs) },
  ha: { key: 'ha', sport: 'mlb', label: 'Hits Allowed', short: 'HA', value: (g) => n(g.hitsAllowed) },
  bba: { key: 'bba', sport: 'mlb', label: 'Walks Allowed', short: 'BBA', value: (g) => n(g.walksAllowed) },

  // ---- NFL passing ----
  passYds: { key: 'passYds', sport: 'nfl', label: 'Passing Yards', short: 'PASS YDS', value: (g) => n(g.passYards) },
  passTds: { key: 'passTds', sport: 'nfl', label: 'Passing TDs', short: 'PASS TD', value: (g) => n(g.passTds) },
  passCmp: { key: 'passCmp', sport: 'nfl', label: 'Completions', short: 'CMP', value: (g) => n(g.passCompletions) },
  passAtt: { key: 'passAtt', sport: 'nfl', label: 'Pass Attempts', short: 'PASS ATT', value: (g) => n(g.passAttempts) },
  ints: { key: 'ints', sport: 'nfl', label: 'Interceptions', short: 'INT', value: (g) => n(g.passInts) },

  // ---- NFL rushing ----
  rushYds: { key: 'rushYds', sport: 'nfl', label: 'Rushing Yards', short: 'RUSH YDS', value: (g) => n(g.rushYards) },
  carries: { key: 'carries', sport: 'nfl', label: 'Carries', short: 'CAR', value: (g) => n(g.rushAttempts) },
  rushTds: { key: 'rushTds', sport: 'nfl', label: 'Rushing TDs', short: 'RUSH TD', value: (g) => n(g.rushTds) },

  // ---- NFL receiving ----
  rec: { key: 'rec', sport: 'nfl', label: 'Receptions', short: 'REC', value: (g) => n(g.receptions) },
  targets: { key: 'targets', sport: 'nfl', label: 'Targets', short: 'TGT', value: (g) => n(g.targets) },
  recYds: { key: 'recYds', sport: 'nfl', label: 'Receiving Yards', short: 'REC YDS', value: (g) => n(g.recYards) },
  recTds: { key: 'recTds', sport: 'nfl', label: 'Receiving TDs', short: 'REC TD', value: (g) => n(g.recTds) },

  // ---- NFL misc ----
  fumbles: { key: 'fumbles', sport: 'nfl', label: 'Fumbles Lost', short: 'FUM', value: (g) => n(g.fumblesLost) },
  fantasyScore: { key: 'fantasyScore', sport: 'nfl', label: 'Fantasy Score (PrizePicks)', short: 'FS', value: nflFantasyScore },

  // ---- NHL skaters ('pts'/'ast' above are shared — NHL rows populate points/assists) ----
  goals: { key: 'goals', sport: 'nhl', label: 'Goals', short: 'G', value: (g) => n(g.goals) },
  sog: { key: 'sog', sport: 'nhl', label: 'Shots on Goal', short: 'SOG', value: (g) => n(g.shotsOnGoal) },
  nhlHits: { key: 'nhlHits', sport: 'nhl', label: 'Hits', short: 'HITS', value: (g) => n(g.hitsDelivered) },
  blocked: { key: 'blocked', sport: 'nhl', label: 'Blocked Shots', short: 'BLKD', value: (g) => n(g.blockedShots) },
  fow: { key: 'fow', sport: 'nhl', label: 'Faceoffs Won', short: 'FOW', value: (g) => n(g.faceoffsWon) },

  // ---- NHL goalies / soccer goalkeepers (shared keys) ----
  saves: { key: 'saves', sport: 'nhl', label: 'Saves', short: 'SV', value: (g) => n(g.saves) },
  ga: { key: 'ga', sport: 'nhl', label: 'Goals Against', short: 'GA', value: (g) => n(g.goalsAgainst) },
  sa: { key: 'sa', sport: 'nhl', label: 'Shots Against', short: 'SA', value: (g) => n(g.shotsAgainst) },

  // ---- Soccer (MLS; 'goals'/'ast' shared) ----
  shots: { key: 'shots', sport: 'mls', label: 'Shots', short: 'SH', value: (g) => n(g.shots) },
  sot: { key: 'sot', sport: 'mls', label: 'Shots on Target', short: 'SOT', value: (g) => n(g.shotsOnTarget) },
  foulsCommitted: { key: 'foulsCommitted', sport: 'mls', label: 'Fouls Committed', short: 'FC', value: (g) => n(g.fouls) },
};

export const STAT_KEYS = Object.keys(STAT_DEFS) as StatKey[];

export const NBA_STAT_KEYS: StatKey[] = [
  'pts', 'reb', 'oreb', 'dreb', 'ast', 'fg3m', 'stl', 'blk', 'tov', 'fouls', 'pra', 'pr', 'pa', 'ra', 'stocks', 'fs',
];
export const MLB_HITTING_KEYS: StatKey[] = [
  'hits', 'tb', 'hr', 'rbi', 'runs', 'sb', 'bb', 'so', 'doubles', 'hrr', 'hitterFs',
];
export const MLB_PITCHING_KEYS: StatKey[] = ['k', 'er', 'outs', 'ha', 'bba'];

// NFL stat keys are position-specific: a QB's markets (passing, plus rushing for
// mobile QBs) are disjoint from a pass-catcher's (receiving). RBs span both the
// ground game and the passing game. Fantasy Score spans every skill position.
export const NFL_QB_KEYS: StatKey[] = ['passYds', 'passTds', 'passCmp', 'passAtt', 'ints', 'rushYds', 'fantasyScore'];
export const NFL_RB_KEYS: StatKey[] = ['rushYds', 'carries', 'rushTds', 'rec', 'targets', 'recYds', 'recTds', 'fumbles', 'fantasyScore'];
export const NFL_WR_KEYS: StatKey[] = ['rec', 'targets', 'recYds', 'recTds', 'fantasyScore'];
export const NFL_TE_KEYS: StatKey[] = ['rec', 'targets', 'recYds', 'recTds', 'fantasyScore'];

// NHL keys are role-specific: skaters (F/D) share one market list; goalies have
// their own. 'pts'/'ast' reuse the shared defs (NHL rows populate points/assists).
export const NHL_SKATER_KEYS: StatKey[] = ['sog', 'pts', 'goals', 'ast', 'nhlHits', 'blocked', 'fow'];
export const NHL_GOALIE_KEYS: StatKey[] = ['saves', 'ga', 'sa'];

// Soccer (MLS): outfield players (F/M/D) vs goalkeepers.
export const SOCCER_OUTFIELD_KEYS: StatKey[] = ['shots', 'sot', 'goals', 'ast', 'foulsCommitted'];
export const SOCCER_GK_KEYS: StatKey[] = ['saves', 'ga', 'sa'];

/** Ordered stat keys offered for a sport (and role: MLB hitter/pitcher, football
 *  position, NHL/soccer goalie vs everyone else). WNBA and CBB share the NBA
 *  keys; CFB shares the NFL keys. */
export function statKeysForSport(sport: Sport, posBucket?: string | null): StatKey[] {
  if (sport === 'mlb') {
    return posBucket === 'P' ? MLB_PITCHING_KEYS : MLB_HITTING_KEYS;
  }
  if (sport === 'nfl' || sport === 'cfb') {
    switch (posBucket) {
      case 'QB':
        return NFL_QB_KEYS;
      case 'RB':
        return NFL_RB_KEYS;
      case 'WR':
        return NFL_WR_KEYS;
      case 'TE':
        return NFL_TE_KEYS;
        default:
        return NFL_QB_KEYS; // fallback (shouldn't happen — every football player has a bucket)
    }
  }
  if (sport === 'nhl') {
    return posBucket === 'G' ? NHL_GOALIE_KEYS : NHL_SKATER_KEYS;
  }
  if (sport === 'mls') {
    return posBucket === 'G' ? SOCCER_GK_KEYS : SOCCER_OUTFIELD_KEYS;
  }
  return NBA_STAT_KEYS; // NBA + WNBA + CBB
}

/** The default stat to open a player page on. */
export function defaultStatForSport(sport: Sport, posBucket?: string | null): StatKey {
  if (sport === 'mlb') return posBucket === 'P' ? 'k' : 'hits';
  if (sport === 'nfl' || sport === 'cfb') {
    switch (posBucket) {
      case 'QB':
        return 'passYds';
      case 'RB':
        return 'rushYds';
      case 'WR':
      case 'TE':
        return 'recYds';
      default:
        return 'passYds';
    }
  }
  if (sport === 'nhl') return posBucket === 'G' ? 'saves' : 'sog';
  if (sport === 'mls') return posBucket === 'G' ? 'saves' : 'shots';
  return 'pts'; // NBA + WNBA + CBB
}

/** Get a stat's value from a game line. */
export function statValue(stat: StatKey, g: GameStatLine): number {
  return STAT_DEFS[stat].value(g);
}

/** The fantasy-score keys and the sport → key lookup — used to normalize a generic
 *  "fantasy score" mention to the right sport's key. WNBA and CBB share the NBA key:
 *  PrizePicks applies ONE uniform basketball scoring formula across all three leagues
 *  (PTS×1 · REB×1.2 · AST×1.5 · STL×3 · BLK×3 · TOV×−1), and its CBB "Fantasy Score"
 *  market is ingested (PP_STAT_MAP.cbb). Sports without a verified PrizePicks scoring
 *  table (NHL, soccer; MLB pitchers) are deliberately absent — we never compute a
 *  fantasy score we can't stand behind. VERIFY the CBB formula against a live PP CBB
 *  Fantasy Score prop in-season (see docs/CBB-READINESS.md) — if PP ever diverges the
 *  college formula, split it out here rather than sharing the NBA key. */
export const FANTASY_SCORE_KEYS: ReadonlySet<StatKey> = new Set<StatKey>([
  'fs',
  'hitterFs',
  'fantasyScore',
]);
export const FANTASY_SCORE_KEY_BY_SPORT: Partial<Record<Sport, StatKey>> = {
  nba: 'fs',
  wnba: 'fs',
  cbb: 'fs',
  mlb: 'hitterFs',
  nfl: 'fantasyScore',
  cfb: 'fantasyScore',
};

/** Analysis windows. Numeric = last N games; 'season' = all games. */
export type StatWindow = 5 | 10 | 20 | 'season';
export const STAT_WINDOWS: StatWindow[] = [5, 10, 20, 'season'];
