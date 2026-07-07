// Free schedule feed for the "tonight" slate.
//   MLB: statsapi.mlb.com/api/v1/schedule  (team ids === our Team.externalId)
//   NBA: ESPN scoreboard                   (matched by team abbreviation)
// Both are keyless and generally NOT IP-blocked. No db here — the orchestrator
// (run-schedule.ts) resolves teams and upserts.

export interface ScheduleGameRow {
  externalId: string;
  /** YYYY-MM-DD game date. */
  dateIso: string;
  /** Full ISO start datetime (UTC) when the feed gives one; undefined otherwise. */
  startTimeIso?: string;
  status: string;
  /** Team match keys: MLB = team externalId; NBA = (normalized) abbreviation. */
  homeKey: string;
  awayKey: string;
  homeProbablePitcher?: string;
  awayProbablePitcher?: string;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FantasyFire/1.0 (+https://fantasyfire.app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

interface MlbSide {
  team: { id: number };
  probablePitcher?: { fullName?: string };
}
interface MlbGame {
  gamePk: number;
  officialDate?: string;
  gameDate?: string;
  status?: { detailedState?: string };
  teams: { home: MlbSide; away: MlbSide };
}
interface MlbScheduleResponse {
  dates?: { games?: MlbGame[] }[];
}

export async function fetchMlbSchedule(date: string): Promise<ScheduleGameRow[]> {
  const data = (await getJson(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,probablePitcher`,
  )) as MlbScheduleResponse;
  const games = data.dates?.[0]?.games ?? [];
  return games.map((g) => ({
    externalId: String(g.gamePk),
    dateIso: (g.officialDate ?? g.gameDate ?? date).slice(0, 10),
    // gameDate is the full UTC first-pitch timestamp; officialDate is date-only.
    startTimeIso: g.gameDate,
    status: g.status?.detailedState ?? 'Scheduled',
    homeKey: String(g.teams.home.team.id),
    awayKey: String(g.teams.away.team.id),
    homeProbablePitcher: g.teams.home.probablePitcher?.fullName,
    awayProbablePitcher: g.teams.away.probablePitcher?.fullName,
  }));
}

// ESPN's NBA abbreviations differ from stats.nba.com's for a handful of teams.
const NBA_ABBR_ALIAS: Record<string, string> = {
  GS: 'GSW',
  NO: 'NOP',
  NY: 'NYK',
  SA: 'SAS',
  UTAH: 'UTA',
  WSH: 'WAS',
  PHO: 'PHX',
};

export function normalizeNbaAbbr(a: string): string {
  const up = a.toUpperCase();
  return NBA_ABBR_ALIAS[up] ?? up;
}

interface EspnCompetitor {
  homeAway: string;
  team: { id?: string; abbreviation?: string };
}
interface EspnEvent {
  id: string | number;
  date?: string;
  competitions?: {
    status?: { type?: { description?: string } };
    competitors?: EspnCompetitor[];
  }[];
}
interface EspnScoreboard {
  events?: EspnEvent[];
}

export async function fetchNbaSchedule(date: string): Promise<ScheduleGameRow[]> {
  const data = (await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date.replace(/-/g, '')}`,
  )) as EspnScoreboard;
  const events = data.events ?? [];
  return events
    .map((e): ScheduleGameRow => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c) => c.homeAway === 'away');
      return {
        externalId: String(e.id),
        dateIso: (e.date ?? `${date}T00:00Z`).slice(0, 10),
        // ESPN `date` is the full UTC tip-off / kickoff timestamp.
        startTimeIso: e.date,
        status: comp?.status?.type?.description ?? 'Scheduled',
        homeKey: home?.team?.abbreviation ? normalizeNbaAbbr(home.team.abbreviation) : '',
        awayKey: away?.team?.abbreviation ? normalizeNbaAbbr(away.team.abbreviation) : '',
      };
    })
    .filter((r) => r.homeKey && r.awayKey);
}

/** ESPN's NFL abbreviations already match our team table; normalize for safety. */
export function normalizeNflAbbr(a: string): string {
  return a.toUpperCase();
}

export async function fetchNflSchedule(date: string): Promise<ScheduleGameRow[]> {
  return fetchEspnSchedule('football/nfl', date, normalizeNflAbbr);
}

/**
 * Generic ESPN scoreboard schedule for the ESPN-native sports (NHL/WNBA/MLS).
 * Their team tables are ingested from the SAME ESPN feed, so games are keyed by
 * the ESPN team ID (=== our Team.externalId) — reliable where abbreviations are
 * not (e.g. NHL Utah is UTAH in /teams but UTA on the scoreboard). Pass
 * `normalize` to key by abbreviation instead (the NFL path).
 */
export async function fetchEspnSchedule(
  path: string,
  date: string,
  normalize?: (a: string) => string,
): Promise<ScheduleGameRow[]> {
  const data = (await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${date.replace(/-/g, '')}`,
  )) as EspnScoreboard;
  const events = data.events ?? [];
  const key = (c: EspnCompetitor | undefined): string => {
    if (!c?.team) return '';
    if (normalize) return c.team.abbreviation ? normalize(c.team.abbreviation) : '';
    return c.team.id ? String(c.team.id) : '';
  };
  return events
    .map((e): ScheduleGameRow => {
      const comp = e.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === 'home');
      const away = comp?.competitors?.find((c) => c.homeAway === 'away');
      return {
        externalId: String(e.id),
        dateIso: (e.date ?? `${date}T00:00Z`).slice(0, 10),
        // ESPN `date` is the full UTC tip-off / kickoff timestamp.
        startTimeIso: e.date,
        status: comp?.status?.type?.description ?? 'Scheduled',
        homeKey: key(home),
        awayKey: key(away),
      };
    })
    .filter((r) => r.homeKey && r.awayKey);
}
