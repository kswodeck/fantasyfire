// ESPN hidden-API client for the NFL ingest (site.api.espn.com/.../football/nfl).
// The sibling of src/ingest/espn.ts (NBA), but NFL box scores split each team
// into MULTIPLE stat groups (passing / rushing / receiving / fumbles / …) and one
// athlete can appear in several (a QB passes and runs; an RB runs and receives),
// so we merge by stable athlete id into one NflBoxRow per athlete-game.
//
// Everything comes from ESPN: /teams (ids + colors), /teams/{id}/roster
// (positions + bios), and scoreboard -> summary (completed box scores). No db here.

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
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

const intOr = (s: string | undefined, fallback = 0): number => {
  const n = parseInt((s ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
};
/** Parse "made/attempted" (e.g. "20/30") to [made, attempted]. */
const slashPair = (s: string | undefined): [number, number] => {
  const [a, b] = (s ?? '').split('/');
  return [intOr(a), intOr(b)];
};

/** Map an ESPN position abbreviation to a prop bucket, or null for non-skill. */
export function toNflPosBucket(position: string | null | undefined): 'QB' | 'RB' | 'WR' | 'TE' | null {
  switch ((position ?? '').toUpperCase()) {
    case 'QB':
      return 'QB';
    case 'RB':
    case 'HB':
    case 'FB':
      return 'RB';
    case 'WR':
      return 'WR';
    case 'TE':
      return 'TE';
    default:
      return null;
  }
}

export interface NflTeam {
  externalId: number;
  abbreviation: string;
  name: string;
}

export interface NflBio {
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

/** One athlete's merged line for a single game. */
export interface NflBoxRow {
  athleteId: number;
  firstName: string;
  lastName: string;
  jersey: string | null;
  teamAbbr: string;
  opponentAbbr: string;
  isHome: boolean;
  eventId: string;
  gameDate: string; // YYYY-MM-DD
  passYards: number;
  passTds: number;
  passCompletions: number;
  passAttempts: number;
  passInts: number;
  rushYards: number;
  rushAttempts: number;
  rushTds: number;
  receptions: number;
  targets: number;
  recYards: number;
  recTds: number;
  fumblesLost: number;
  /** Stat groups this athlete appeared in (for posBucket inference when off-roster). */
  groups: Set<string>;
}

// ---- Teams ----

interface TeamsApi {
  sports?: { leagues?: { teams?: { team?: { id?: string; abbreviation?: string; displayName?: string; name?: string } }[] }[] }[];
}

export async function getNflTeams(): Promise<NflTeam[]> {
  const j = await getJson<TeamsApi>(`${SITE}/teams`);
  const list = j.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return list
    .map((t) => t.team)
    .filter((t): t is NonNullable<typeof t> => !!t?.id && !!t.abbreviation)
    .map((t) => ({
      externalId: Number(t.id),
      abbreviation: t.abbreviation!.toUpperCase(),
      name: t.name ?? t.displayName ?? t.abbreviation!,
    }));
}

// ---- Rosters -> bios + positions ----

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
  athletes?: { position?: string; items?: RosterAthlete[] }[];
}

/** athleteId -> bio for one team's full roster (all position groups). */
export async function getNflRosterBios(teamExternalId: number): Promise<Map<number, NflBio>> {
  const map = new Map<number, NflBio>();
  const j = await getJson<RosterApi>(`${SITE}/teams/${teamExternalId}/roster`).catch(() => ({ athletes: [] }) as RosterApi);
  for (const group of j.athletes ?? []) {
    for (const a of group.items ?? []) {
      if (!a.id) continue;
      map.set(Number(a.id), {
        position: a.position?.abbreviation ?? null,
        jersey: a.jersey ?? null,
        height: a.displayHeight ?? null,
        weight: a.weight ?? null,
        college: a.college?.name ?? null,
        draftYear: a.draft?.year ?? null,
        draftRound: a.draft?.round ?? null,
        draftNumber: a.draft?.selection ?? null,
        fromYear: a.experience?.years != null ? new Date().getUTCFullYear() - a.experience.years : null,
      });
    }
  }
  return map;
}

// ---- Box scores (scoreboard -> summary) ----

interface ScoreboardApi {
  events?: { id?: string | number; date?: string; competitions?: { status?: { type?: { state?: string } } }[] }[];
}
interface BoxAthlete {
  athlete?: { id?: string; firstName?: string; lastName?: string; displayName?: string; jersey?: string };
  stats?: string[];
}
interface BoxStatGroup {
  name?: string;
  labels?: string[];
  athletes?: BoxAthlete[];
}
interface SummaryApi {
  boxscore?: { players?: { team?: { abbreviation?: string }; statistics?: BoxStatGroup[] }[] };
  header?: { competitions?: { competitors?: { homeAway?: string; team?: { abbreviation?: string } }[] }[] };
}

/** Completed game events for one (year, seasonType, week). */
export async function fetchNflWeekEvents(
  year: number,
  seasonType: number,
  week: number,
): Promise<{ eventId: string; dateIso: string }[]> {
  const j = await getJson<ScoreboardApi>(
    `${SITE}/scoreboard?dates=${year}&seasontype=${seasonType}&week=${week}`,
  ).catch(() => ({ events: [] }) as ScoreboardApi);
  return (j.events ?? [])
    .filter((e) => e.competitions?.[0]?.status?.type?.state === 'post')
    .map((e) => ({ eventId: String(e.id), dateIso: (e.date ?? '').slice(0, 10) }));
}

const FF = (g: BoxStatGroup): ((athlete: BoxAthlete) => (name: string) => string | undefined) => {
  const labels = g.labels ?? [];
  return (a) => (name) => {
    const i = labels.indexOf(name);
    return i >= 0 ? a.stats?.[i] : undefined;
  };
};

/** Box scores for one game, merged across stat groups into one row per athlete. */
export async function fetchNflEventBoxScores(eventId: string, dateIso: string): Promise<NflBoxRow[]> {
  const sum = await getJson<SummaryApi>(`${SITE}/summary?event=${eventId}`).catch(() => null);
  if (!sum?.boxscore?.players) return [];

  const competitors = sum.header?.competitions?.[0]?.competitors ?? [];
  const homeAwayByAbbr = new Map(
    competitors.map((c) => [(c.team?.abbreviation ?? '').toUpperCase(), c.homeAway]),
  );
  const abbrs = [...homeAwayByAbbr.keys()];

  const byAthlete = new Map<number, NflBoxRow>();
  for (const teamBlock of sum.boxscore.players) {
    const teamAbbr = (teamBlock.team?.abbreviation ?? '').toUpperCase();
    const opponentAbbr = abbrs.find((a) => a !== teamAbbr) ?? '';
    const isHome = homeAwayByAbbr.get(teamAbbr) === 'home';

    for (const group of teamBlock.statistics ?? []) {
      const name = group.name ?? '';
      if (!['passing', 'rushing', 'receiving', 'fumbles'].includes(name)) continue;
      const cell = FF(group);
      for (const a of group.athletes ?? []) {
        const id = a.athlete?.id ? Number(a.athlete.id) : null;
        if (!id || !a.stats?.length) continue;
        let row = byAthlete.get(id);
        if (!row) {
          row = {
            athleteId: id,
            firstName: a.athlete?.firstName ?? (a.athlete?.displayName ?? '').split(' ')[0] ?? '',
            lastName:
              a.athlete?.lastName ?? (a.athlete?.displayName ?? '').split(' ').slice(1).join(' ') ?? '',
            jersey: a.athlete?.jersey ?? null,
            teamAbbr,
            opponentAbbr,
            isHome,
            eventId,
            gameDate: dateIso,
            passYards: 0, passTds: 0, passCompletions: 0, passAttempts: 0, passInts: 0,
            rushYards: 0, rushAttempts: 0, rushTds: 0,
            receptions: 0, targets: 0, recYards: 0, recTds: 0,
            fumblesLost: 0,
            groups: new Set(),
          };
          byAthlete.set(id, row);
        }
        row.groups.add(name);
        const at = cell(a);
        if (name === 'passing') {
          const [cmp, att] = slashPair(at('C/ATT'));
          row.passCompletions = cmp;
          row.passAttempts = att;
          row.passYards = intOr(at('YDS'));
          row.passTds = intOr(at('TD'));
          row.passInts = intOr(at('INT'));
        } else if (name === 'rushing') {
          row.rushAttempts = intOr(at('CAR'));
          row.rushYards = intOr(at('YDS'));
          row.rushTds = intOr(at('TD'));
        } else if (name === 'receiving') {
          row.receptions = intOr(at('REC'));
          row.recYards = intOr(at('YDS'));
          row.recTds = intOr(at('TD'));
          row.targets = intOr(at('TGTS'));
        } else if (name === 'fumbles') {
          row.fumblesLost = intOr(at('LOST'));
        }
      }
    }
  }
  return [...byAthlete.values()];
}

/** Infer a prop bucket from the stat groups a player appeared in (roster fallback). */
export function inferPosBucket(row: NflBoxRow): 'QB' | 'RB' | 'WR' | 'TE' | null {
  if (row.passAttempts > 0) return 'QB';
  if (row.targets > 0 || row.receptions > 0) {
    // Can't tell WR from TE by stats — default pass-catchers to WR; RBs are caught
    // by the rushing-heavy branch below.
    if (row.rushAttempts > row.receptions) return 'RB';
    return 'WR';
  }
  if (row.rushAttempts > 0) return 'RB';
  return null;
}

/** NFL season (start year). Aug–Dec -> this year; Jan–Jul -> last year. */
export function nflSeason(now: Date = new Date()): number {
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? y : y - 1;
}
