// Generic ESPN hidden-API client for the ESPN-native sports (NHL / WNBA / MLS)
// — the multi-sport sibling of src/ingest/nfl/client.ts. Everything comes
// from site.api.espn.com: /teams (ids + names), /teams/{id}/roster (positions +
// bios), and scoreboard -> summary (completed box scores). The three summary
// shapes differ by sport family:
//   hockey     -> boxscore.players[].statistics groups (forwards/defenses/goalies)
//                 with a `keys` array per group
//   basketball -> boxscore.players[].statistics[0] with a `names` array (same as
//                 the NBA fallback client in espn.ts)
//   soccer     -> top-level `rosters` with named per-player stat objects
// No db here — run-ingest-espn.ts resolves teams/players and upserts.
import type { Sport } from '../lib/sports';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports';
const UA = { 'User-Agent': 'FantasyFire/1.0 (+https://fantasyfire.app)' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T = unknown>(url: string, attempts = 4, timeoutMs = 20000): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: UA, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`ESPN HTTP ${res.status}`);
      } else if (!res.ok) {
        throw new Error(`ESPN HTTP ${res.status}: ${url}`);
      } else {
        return (await res.json()) as T;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    if (i < attempts) await sleep(400 * 2 ** (i - 1) + Math.random() * 300);
  }
  throw lastErr ?? new Error(`ESPN request failed: ${url}`);
}

const numOr = (s: unknown, fallback = 0): number => {
  const n = typeof s === 'number' ? s : parseFloat(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

/** Parse "MM:SS" time-on-ice to fractional minutes; null for blank/garbage. */
export function parseToiMinutes(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^(\d+):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

/** ESPN league path per ESPN-native sport (mirrors injuries.ts / gameOdds.ts). */
export const ESPN_SPORT_PATH: Partial<Record<Sport, string>> = {
  nhl: 'hockey/nhl',
  wnba: 'basketball/wnba',
  mls: 'soccer/usa.1',
};

// ---- Teams (same shape across all ESPN sports) ----

export interface EspnLeagueTeam {
  externalId: number;
  abbreviation: string;
  name: string;
}

interface TeamsApi {
  sports?: {
    leagues?: {
      teams?: { team?: { id?: string; abbreviation?: string; displayName?: string; name?: string; shortDisplayName?: string } }[];
    }[];
  }[];
}

export async function getEspnTeams(path: string): Promise<EspnLeagueTeam[]> {
  const j = await getJson<TeamsApi>(`${SITE}/${path}/teams?limit=60`);
  const list = j.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return list
    .map((t) => t.team)
    .filter((t): t is NonNullable<typeof t> => !!t?.id && !!t.abbreviation)
    .map((t) => ({
      externalId: Number(t.id),
      abbreviation: t.abbreviation!.toUpperCase(),
      name: t.name ?? t.shortDisplayName ?? t.displayName ?? t.abbreviation!,
    }));
}

// ---- Rosters -> bios + positions (grouped for NHL, flat for WNBA/soccer) ----

export interface EspnBio {
  position: string | null;
  jersey: string | null;
  height: string | null;
  weight: number | null;
  college: string | null;
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
  fromYear: number | null;
}

interface RosterAthlete {
  id?: string;
  position?: { abbreviation?: string };
  jersey?: string;
  displayHeight?: string;
  weight?: number;
  college?: { name?: string };
  experience?: { years?: number };
  draft?: { year?: number; round?: number; selection?: number };
}
interface RosterApi {
  // NHL groups athletes by position ({ position, items }); WNBA/soccer return a
  // flat athlete list. Both arrive under `athletes`.
  athletes?: (RosterAthlete & { items?: RosterAthlete[] })[];
}

/** athleteId -> bio for one team's full roster (grouped or flat shape). */
export async function getEspnRosterBios(path: string, teamExternalId: number): Promise<Map<number, EspnBio>> {
  const map = new Map<number, EspnBio>();
  const j = await getJson<RosterApi>(`${SITE}/${path}/teams/${teamExternalId}/roster`).catch(
    () => ({ athletes: [] }) as RosterApi,
  );
  const put = (a: RosterAthlete) => {
    if (!a.id) return;
    map.set(Number(a.id), {
      position: a.position?.abbreviation ?? null,
      jersey: a.jersey ?? null,
      height: a.displayHeight ?? null,
      weight: a.weight != null ? Math.round(a.weight) : null,
      college: a.college?.name ?? null,
      draftYear: a.draft?.year ?? null,
      draftRound: a.draft?.round ?? null,
      draftNumber: a.draft?.selection ?? null,
      fromYear: a.experience?.years != null ? new Date().getUTCFullYear() - a.experience.years : null,
    });
  };
  for (const entry of j.athletes ?? []) {
    if (Array.isArray(entry.items)) for (const a of entry.items) put(a);
    else put(entry);
  }
  return map;
}

// ---- Scoreboard -> completed events ----

interface ScoreboardApi {
  events?: {
    id?: string | number;
    date?: string;
    season?: { type?: number };
    competitions?: { status?: { type?: { state?: string } } }[];
  }[];
}

export interface EspnEventRef {
  eventId: string;
  dateIso: string;
  /** ESPN season type (1 = pre, 2 = regular, 3 = post); undefined when absent. */
  seasonType?: number;
}

/** Completed events on one date (YYYY-MM-DD). Throws on a failed fetch — the
 *  caller decides how to retry; swallowing it here would leave a silent,
 *  PERMANENT gap in the history (the incremental walk never revisits old dates). */
export async function fetchEspnCompletedEvents(path: string, date: string): Promise<EspnEventRef[]> {
  const j = await getJson<ScoreboardApi>(
    `${SITE}/${path}/scoreboard?dates=${date.replace(/-/g, '')}`,
  );
  return (j.events ?? [])
    .filter((e) => e.competitions?.[0]?.status?.type?.state === 'post')
    .map((e) => ({
      eventId: String(e.id),
      dateIso: (e.date ?? `${date}T00:00Z`).slice(0, 10),
      seasonType: e.season?.type,
    }));
}

// ---- Box scores ----

/** Box-score fetch result: player lines + the two teams as the summary names
 *  them. Teams ride along because ESPN's /teams endpoint lists only the CURRENT
 *  league members — historical games can involve teams that have since left
 *  the league or relocated, and their rows must still resolve to a team. */
export interface EspnBoxScoreResult {
  rows: EspnGenBoxRow[];
  teams: EspnLeagueTeam[];
}

/** One athlete's line for a single game, sport-agnostic: `stats` maps our
 *  PlayerGameStat column names to values. */
export interface EspnGenBoxRow {
  athleteId: number;
  firstName: string;
  lastName: string;
  jersey: string | null;
  /** Position abbreviation from the summary (when the feed carries one). */
  posAbbr: string | null;
  teamAbbr: string;
  opponentAbbr: string;
  /** ESPN team ids from the same summary — the RELIABLE team keys. Abbreviations
   *  can differ between ESPN endpoints (e.g. NHL Utah is UTAH in /teams but UTA
   *  in summaries), so resolution goes id-first with abbr as the fallback. */
  teamExternalId: number | null;
  opponentExternalId: number | null;
  isHome: boolean;
  eventId: string;
  gameDate: string; // YYYY-MM-DD
  minutes: number | null;
  plusMinus: number | null;
  /** Soccer only: started vs sub appearance. */
  started: boolean | null;
  stats: Record<string, number>;
}

/** Resolve first/last name. Summaries often ship lastName WITHOUT firstName
 *  (hockey, soccer), so a lone lastName is combined with displayName rather than
 *  trusted alone — injury/props name-matching and slugs need the full name. */
function splitName(displayName: string | undefined, firstName?: string, lastName?: string): { firstName: string; lastName: string } {
  if (firstName && lastName) {
    return { firstName, lastName };
  }
  const dn = (displayName ?? '').trim();
  if (dn) {
    // Prefer the feed's own lastName as the split point ("Jean-Philippe Mateta").
    if (lastName && dn.length > lastName.length && dn.toLowerCase().endsWith(lastName.toLowerCase())) {
      return { firstName: dn.slice(0, dn.length - lastName.length).trim(), lastName };
    }
    const parts = dn.split(/\s+/);
    if (parts.length > 1) {
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
    }
    // Mononyms (e.g. "Casemiro") — store as the last name.
    return { firstName: firstName ?? '', lastName: dn };
  }
  return { firstName: firstName ?? '', lastName: lastName ?? '' };
}

// -- hockey (NHL) --

interface HockeyBoxAthlete {
  athlete?: { id?: string; firstName?: string; lastName?: string; displayName?: string; jersey?: string; position?: { abbreviation?: string } };
  stats?: string[];
}
interface HockeyStatGroup {
  name?: string;
  keys?: string[];
  athletes?: HockeyBoxAthlete[];
}
interface HeaderCompetitor {
  homeAway?: string;
  team?: { id?: string; abbreviation?: string; displayName?: string; name?: string; shortDisplayName?: string };
}
interface HockeySummaryApi {
  boxscore?: { players?: { team?: { abbreviation?: string }; statistics?: HockeyStatGroup[] }[] };
  header?: { competitions?: { competitors?: HeaderCompetitor[] }[] };
}

function competitorTeams(competitors: HeaderCompetitor[]): EspnLeagueTeam[] {
  return competitors
    .map((c) => c.team)
    .filter((t): t is NonNullable<typeof t> => !!t?.id && !!t.abbreviation)
    .map((t) => ({
      externalId: Number(t.id),
      abbreviation: t.abbreviation!.toUpperCase(),
      name: t.name ?? t.shortDisplayName ?? t.displayName ?? t.abbreviation!,
    }));
}

/** Stamp each row's team/opponent ESPN ids from the summary's own team list
 *  (abbreviations are consistent WITHIN one summary document). */
function attachTeamIds(rows: EspnGenBoxRow[], teams: EspnLeagueTeam[]): EspnBoxScoreResult {
  const idByAbbr = new Map(teams.map((t) => [t.abbreviation, t.externalId]));
  for (const r of rows) {
    r.teamExternalId = idByAbbr.get(r.teamAbbr) ?? null;
    r.opponentExternalId = idByAbbr.get(r.opponentAbbr) ?? null;
  }
  return { rows, teams };
}

/** NHL box scores for one game. Skaters and goalies come from separate stat
 *  groups (the aggregate "skaters" group is skipped — forwards/defenses cover it). */
export async function fetchNhlEventBoxScores(path: string, eventId: string, dateIso: string): Promise<EspnBoxScoreResult> {
  const sum = await getJson<HockeySummaryApi>(`${SITE}/${path}/summary?event=${eventId}`);
  if (!sum?.boxscore?.players) return { rows: [], teams: [] };

  const competitors = sum.header?.competitions?.[0]?.competitors ?? [];
  const homeAwayByAbbr = new Map(
    competitors.map((c) => [(c.team?.abbreviation ?? '').toUpperCase(), c.homeAway]),
  );
  const abbrs = [...homeAwayByAbbr.keys()];

  const rows = new Map<number, EspnGenBoxRow>();
  for (const teamBlock of sum.boxscore.players) {
    const teamAbbr = (teamBlock.team?.abbreviation ?? '').toUpperCase();
    const opponentAbbr = abbrs.find((a) => a !== teamAbbr) ?? '';
    const isHome = homeAwayByAbbr.get(teamAbbr) === 'home';

    for (const group of teamBlock.statistics ?? []) {
      const groupName = group.name ?? '';
      if (!['forwards', 'defenses', 'goalies'].includes(groupName)) continue;
      const keys = group.keys ?? [];
      const at = (stats: string[] | undefined, key: string): string | undefined => {
        const i = keys.indexOf(key);
        return i >= 0 ? stats?.[i] : undefined;
      };
      for (const a of group.athletes ?? []) {
        const id = a.athlete?.id ? Number(a.athlete.id) : null;
        if (!id || !a.stats?.length || rows.has(id)) continue;
        const { firstName, lastName } = splitName(a.athlete?.displayName, a.athlete?.firstName, a.athlete?.lastName);
        const base: EspnGenBoxRow = {
          athleteId: id,
          firstName,
          lastName,
          jersey: a.athlete?.jersey ?? null,
          posAbbr: a.athlete?.position?.abbreviation ?? (groupName === 'goalies' ? 'G' : null),
          teamAbbr,
          opponentAbbr,
          teamExternalId: null,
          opponentExternalId: null,
          isHome,
          eventId,
          gameDate: dateIso,
          minutes: parseToiMinutes(at(a.stats, 'timeOnIce')),
          plusMinus: groupName === 'goalies' ? null : Math.trunc(numOr(at(a.stats, 'plusMinus'))),
          started: null,
          stats: {},
        };
        if (groupName === 'goalies') {
          base.stats = {
            saves: numOr(at(a.stats, 'saves')),
            goalsAgainst: numOr(at(a.stats, 'goalsAgainst')),
            shotsAgainst: numOr(at(a.stats, 'shotsAgainst')),
          };
        } else {
          const goals = numOr(at(a.stats, 'goals'));
          const assists = numOr(at(a.stats, 'assists'));
          base.stats = {
            goals,
            assists,
            points: goals + assists,
            // ESPN's skater `shotsTotal` is shots on goal (label "S"); missed
            // shots are the separate `shotsMissed`.
            shotsOnGoal: numOr(at(a.stats, 'shotsTotal')),
            hitsDelivered: numOr(at(a.stats, 'hits')),
            blockedShots: numOr(at(a.stats, 'blockedShots')),
            faceoffsWon: numOr(at(a.stats, 'faceoffsWon')),
          };
        }
        rows.set(id, base);
      }
    }
  }
  return attachTeamIds([...rows.values()], competitorTeams(competitors));
}

// -- basketball (WNBA) --

interface BasketballBoxAthlete {
  athlete?: { id?: string; firstName?: string; lastName?: string; displayName?: string; jersey?: string; position?: { abbreviation?: string } };
  didNotPlay?: boolean;
  stats?: string[];
}
interface BasketballSummaryApi {
  boxscore?: {
    players?: {
      team?: { abbreviation?: string };
      statistics?: { names?: string[]; athletes?: BasketballBoxAthlete[] }[];
    }[];
  };
  header?: { competitions?: { competitors?: HeaderCompetitor[] }[] };
}

function madeAtt(s: string | undefined): [number, number] {
  const parts = (s ?? '').split('-');
  return [Math.trunc(numOr(parts[0])), Math.trunc(numOr(parts[1]))];
}

/** WNBA box scores for one game (ESPN names: MIN PTS FG 3PT FT REB AST TO STL BLK OREB DREB PF +/-). */
export async function fetchWnbaEventBoxScores(path: string, eventId: string, dateIso: string): Promise<EspnBoxScoreResult> {
  const sum = await getJson<BasketballSummaryApi>(`${SITE}/${path}/summary?event=${eventId}`);
  if (!sum?.boxscore?.players) return { rows: [], teams: [] };

  const competitors = sum.header?.competitions?.[0]?.competitors ?? [];
  const homeAwayByAbbr = new Map(
    competitors.map((c) => [(c.team?.abbreviation ?? '').toUpperCase(), c.homeAway]),
  );
  const abbrs = [...homeAwayByAbbr.keys()];

  const rows: EspnGenBoxRow[] = [];
  for (const teamBlock of sum.boxscore.players) {
    const teamAbbr = (teamBlock.team?.abbreviation ?? '').toUpperCase();
    const opponentAbbr = abbrs.find((a) => a !== teamAbbr) ?? '';
    const isHome = homeAwayByAbbr.get(teamAbbr) === 'home';
    const block = teamBlock.statistics?.[0];
    const names = block?.names ?? [];
    const at = (stats: string[] | undefined, name: string): string | undefined => {
      const i = names.indexOf(name);
      return i >= 0 ? stats?.[i] : undefined;
    };
    for (const a of block?.athletes ?? []) {
      if (a.didNotPlay) continue;
      const id = a.athlete?.id ? Number(a.athlete.id) : null;
      if (!id || !a.stats?.length) continue;
      const [fgm, fga] = madeAtt(at(a.stats, 'FG'));
      const [fg3m, fg3a] = madeAtt(at(a.stats, '3PT'));
      const [ftm, fta] = madeAtt(at(a.stats, 'FT'));
      const min = at(a.stats, 'MIN');
      const pm = at(a.stats, '+/-');
      const { firstName, lastName } = splitName(a.athlete?.displayName, a.athlete?.firstName, a.athlete?.lastName);
      rows.push({
        athleteId: id,
        firstName,
        lastName,
        jersey: a.athlete?.jersey ?? null,
        posAbbr: a.athlete?.position?.abbreviation ?? null,
        teamAbbr,
        opponentAbbr,
        teamExternalId: null,
        opponentExternalId: null,
        isHome,
        eventId,
        gameDate: dateIso,
        minutes: min == null || min === '' ? null : Math.trunc(numOr(min)),
        plusMinus: pm == null || pm === '' ? null : Math.trunc(numOr(pm.replace('+', ''))),
        started: null,
        stats: {
          points: numOr(at(a.stats, 'PTS')),
          rebounds: numOr(at(a.stats, 'REB')),
          oreb: numOr(at(a.stats, 'OREB')),
          dreb: numOr(at(a.stats, 'DREB')),
          assists: numOr(at(a.stats, 'AST')),
          steals: numOr(at(a.stats, 'STL')),
          blocks: numOr(at(a.stats, 'BLK')),
          turnovers: numOr(at(a.stats, 'TO')),
          fouls: numOr(at(a.stats, 'PF')),
          fgm,
          fga,
          fg3m,
          fg3a,
          ftm,
          fta,
        },
      });
    }
  }
  return attachTeamIds(rows, competitorTeams(competitors));
}

// -- soccer (MLS) --

interface SoccerRosterEntry {
  athlete?: { id?: string; displayName?: string; lastName?: string };
  position?: { abbreviation?: string };
  jersey?: string | number;
  starter?: boolean;
  subbedIn?: boolean | { didSub?: boolean };
  stats?: { name?: string; value?: number }[];
}
interface SoccerSummaryApi {
  rosters?: {
    homeAway?: string;
    team?: { id?: string; abbreviation?: string; displayName?: string; name?: string; shortDisplayName?: string };
    roster?: SoccerRosterEntry[];
  }[];
}

const subbedIn = (s: SoccerRosterEntry['subbedIn']): boolean =>
  typeof s === 'object' && s != null ? s.didSub === true : s === true;

/** Soccer match player stats for one game (from the summary's `rosters`). Unused
 *  substitutes (never came on) are skipped. */
export async function fetchSoccerEventBoxScores(path: string, eventId: string, dateIso: string): Promise<EspnBoxScoreResult> {
  const sum = await getJson<SoccerSummaryApi>(`${SITE}/${path}/summary?event=${eventId}`);
  if (!sum?.rosters?.length) return { rows: [], teams: [] };

  const teams = competitorTeams(sum.rosters as HeaderCompetitor[]);
  const abbrs = sum.rosters.map((r) => (r.team?.abbreviation ?? '').toUpperCase());
  const rows: EspnGenBoxRow[] = [];
  for (const teamBlock of sum.rosters) {
    const teamAbbr = (teamBlock.team?.abbreviation ?? '').toUpperCase();
    const opponentAbbr = abbrs.find((a) => a !== teamAbbr) ?? '';
    const isHome = teamBlock.homeAway === 'home';
    for (const p of teamBlock.roster ?? []) {
      const id = p.athlete?.id ? Number(p.athlete.id) : null;
      if (!id) continue;
      const started = p.starter === true;
      if (!started && !subbedIn(p.subbedIn)) continue; // unused sub — no appearance
      const stat = new Map<string, number>();
      for (const s of p.stats ?? []) {
        if (s.name) stat.set(s.name, numOr(s.value));
      }
      const { firstName, lastName } = splitName(p.athlete?.displayName, undefined, p.athlete?.lastName);
      rows.push({
        athleteId: id,
        firstName,
        lastName,
        jersey: p.jersey != null ? String(p.jersey) : null,
        posAbbr: p.position?.abbreviation ?? null,
        teamAbbr,
        opponentAbbr,
        teamExternalId: null,
        opponentExternalId: null,
        isHome,
        eventId,
        gameDate: dateIso,
        minutes: null, // the feed carries no per-player minutes
        plusMinus: null,
        started,
        stats: {
          goals: stat.get('totalGoals') ?? 0,
          assists: stat.get('goalAssists') ?? 0,
          shots: stat.get('totalShots') ?? 0,
          shotsOnTarget: stat.get('shotsOnTarget') ?? 0,
          fouls: stat.get('foulsCommitted') ?? 0,
          saves: stat.get('saves') ?? 0,
          goalsAgainst: stat.get('goalsConceded') ?? 0,
          shotsAgainst: stat.get('shotsFaced') ?? 0,
        },
      });
    }
  }
  return attachTeamIds(rows, teams);
}

// ---- Position bucket mappers ----

/** NHL: C/LW/RW/W -> F; D -> D; G -> G. */
export function toNhlPosBucket(position: string | null | undefined): 'F' | 'D' | 'G' | null {
  switch ((position ?? '').toUpperCase()) {
    case 'C':
    case 'LW':
    case 'RW':
    case 'W':
    case 'F':
      return 'F';
    case 'D':
      return 'D';
    case 'G':
      return 'G';
    default:
      return null;
  }
}

/** WNBA: G/F/C (hybrids like G-F bucket on their first letter, matching the NBA). */
export function toWnbaPosBucket(position: string | null | undefined): 'G' | 'F' | 'C' | null {
  const first = (position ?? '').trim().toUpperCase()[0];
  return first === 'G' || first === 'F' || first === 'C' ? first : null;
}

/** Soccer: collapse granular formation slots (CD-L, RM, ST, …) to F/M/D/G. */
export function toSoccerPosBucket(position: string | null | undefined): 'F' | 'M' | 'D' | 'G' | null {
  const p = (position ?? '').trim().toUpperCase();
  if (!p || p === 'SUB') return null;
  const root = p.split('-')[0]; // CD-L -> CD, CM-R -> CM
  if (root === 'G' || root === 'GK') return 'G';
  if (['D', 'CD', 'CB', 'LB', 'RB', 'WB', 'LWB', 'RWB', 'SW'].includes(root)) return 'D';
  if (['M', 'CM', 'DM', 'AM', 'LM', 'RM', 'CDM', 'CAM'].includes(root)) return 'M';
  if (['F', 'CF', 'ST', 'S', 'LW', 'RW', 'W', 'SS'].includes(root)) return 'F';
  return null;
}
