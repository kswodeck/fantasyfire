// src/ingest/mlb.ts
//
// Lightweight client for MLB's free public Stats API (statsapi.mlb.com, no key).
// Unlike stats.nba.com it does not block cloud IPs, but we still throttle with a
// small concurrency pool because the ingest makes one game-log call per player.

const BASE = 'https://statsapi.mlb.com/api/v1';

export interface MlbTeam {
  externalId: number;
  abbreviation: string;
  name: string;
}

export interface MlbPerson {
  externalId: number;
  firstName: string;
  lastName: string;
  position: string | null; // primaryPosition abbreviation, e.g. "P", "CF"
  posBucket: 'P' | 'H';
  jersey: string | null;
  height: string | null; // normalized "6-2"
  weight: number | null;
  country: string | null;
  fromYear: number | null; // MLB debut year
}

export interface MlbGameLogRow {
  personId: number;
  gamePk: string;
  date: string; // YYYY-MM-DD
  teamId: number; // player's team that game (external)
  opponentId: number; // external
  isHome: boolean;
  group: 'hitting' | 'pitching';
  // hitting
  atBats?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  runs?: number;
  rbi?: number;
  walks?: number;
  strikeouts?: number;
  stolenBases?: number;
  totalBases?: number;
  hbp?: number;
  // pitching
  outs?: number;
  hitsAllowed?: number;
  runsAllowed?: number;
  earnedRuns?: number;
  walksAllowed?: number;
  strikeoutsPitched?: number;
  pitcherWin?: boolean;
}

// statsapi responses are loosely typed; we read a handful of fields defensively.
interface TeamApi {
  id: number;
  abbreviation?: string;
  name?: string;
  active?: boolean;
  sport?: { id?: number };
}
interface PersonApi {
  id: number;
  firstName?: string;
  lastName?: string;
  useName?: string;
  primaryNumber?: string;
  height?: string;
  weight?: string | number;
  birthCountry?: string;
  mlbDebutDate?: string;
  primaryPosition?: { abbreviation?: string; type?: string };
}
interface StatSplit {
  gameType?: string;
  isHome?: boolean;
  date?: string;
  game?: { gamePk?: number };
  team?: { id?: number };
  opponent?: { id?: number };
  stat?: Record<string, unknown>;
}
interface GameLogResponse {
  stats?: Array<{ splits?: StatSplit[] }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T = unknown>(url: string, attempts = 4, timeoutMs = 20000): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`MLB HTTP ${res.status}`);
      } else if (!res.ok) {
        throw new Error(`MLB HTTP ${res.status}: ${url}`);
      } else {
        return (await res.json()) as T;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    if (i < attempts) await sleep(400 * 2 ** (i - 1) + Math.random() * 300);
  }
  throw lastErr ?? new Error(`MLB request failed: ${url}`);
}

/** Run an async fn over items with bounded concurrency. */
export async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 8,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** "6.1" innings -> 19 outs. */
function inningsToOuts(ip: unknown): number {
  const s = String(ip ?? '0');
  const [whole, frac = '0'] = s.split('.');
  return num(whole) * 3 + num(frac);
}

function normalizeHeight(h: unknown): string | null {
  const s = String(h ?? '');
  const m = s.match(/(\d+)'\s*(\d+)/);
  return m ? `${m[1]}-${m[2]}` : s || null;
}

export async function getMlbTeams(): Promise<MlbTeam[]> {
  const j = await fetchJson<{ teams?: TeamApi[] }>(`${BASE}/teams?sportId=1`);
  return (j.teams ?? [])
    .filter((t) => t.sport?.id === 1 && t.active !== false && t.abbreviation)
    .map((t) => ({ externalId: t.id, abbreviation: t.abbreviation!, name: t.name ?? t.abbreviation! }));
}

export async function getMlbRosterPersonIds(teamId: number, season: number): Promise<number[]> {
  // fullSeason = everyone who was rostered during the season (includes IL'd /
  // traded players), so stars who are currently injured aren't dropped.
  const j = await fetchJson<{ roster?: Array<{ person?: { id?: number } }> }>(
    `${BASE}/teams/${teamId}/roster?rosterType=fullSeason&season=${season}`,
  ).catch(() => ({ roster: [] as Array<{ person?: { id?: number } }> }));
  return (j.roster ?? []).map((r) => r.person?.id).filter((x): x is number => !!x);
}

export async function getMlbPeople(ids: number[]): Promise<Map<number, MlbPerson>> {
  const map = new Map<number, MlbPerson>();
  for (const ch of chunk(ids, 40)) {
    const j = await fetchJson<{ people?: PersonApi[] }>(`${BASE}/people?personIds=${ch.join(',')}`);
    for (const p of j.people ?? []) {
      const isPitcher = p.primaryPosition?.type === 'Pitcher';
      map.set(p.id, {
        externalId: p.id,
        firstName: p.firstName ?? p.useName ?? '',
        lastName: p.lastName ?? '',
        position: p.primaryPosition?.abbreviation ?? null,
        posBucket: isPitcher ? 'P' : 'H',
        jersey: p.primaryNumber ?? null,
        height: normalizeHeight(p.height),
        weight: p.weight ? num(p.weight) : null,
        country: p.birthCountry ?? null,
        fromYear: p.mlbDebutDate ? Number(p.mlbDebutDate.slice(0, 4)) || null : null,
      });
    }
  }
  return map;
}

export async function getMlbGameLog(
  personId: number,
  group: 'hitting' | 'pitching',
  season: number,
): Promise<MlbGameLogRow[]> {
  const j = await fetchJson<GameLogResponse>(
    `${BASE}/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}`,
  ).catch(() => null);
  const splits: StatSplit[] = j?.stats?.[0]?.splits ?? [];
  const rows: MlbGameLogRow[] = [];
  for (const s of splits) {
    if (s.gameType && s.gameType !== 'R') continue; // regular season only
    const gamePk = s.game?.gamePk;
    const teamId = s.team?.id;
    const opponentId = s.opponent?.id;
    if (!gamePk || !teamId || !opponentId || !s.date) continue;
    const st = s.stat ?? {};
    const base: MlbGameLogRow = {
      personId,
      gamePk: String(gamePk),
      date: s.date,
      teamId,
      opponentId,
      isHome: !!s.isHome,
      group,
    };
    if (group === 'hitting') {
      rows.push({
        ...base,
        atBats: num(st.atBats),
        hits: num(st.hits),
        doubles: num(st.doubles),
        triples: num(st.triples),
        homeRuns: num(st.homeRuns),
        runs: num(st.runs),
        rbi: num(st.rbi),
        walks: num(st.baseOnBalls),
        strikeouts: num(st.strikeOuts),
        stolenBases: num(st.stolenBases),
        totalBases: num(st.totalBases),
        hbp: num(st.hitByPitch),
      });
    } else {
      rows.push({
        ...base,
        outs: st.outs != null ? num(st.outs) : inningsToOuts(st.inningsPitched),
        hitsAllowed: num(st.hits),
        runsAllowed: num(st.runs),
        earnedRuns: num(st.earnedRuns),
        walksAllowed: num(st.baseOnBalls),
        strikeoutsPitched: num(st.strikeOuts),
        pitcherWin: num(st.wins) > 0,
      });
    }
  }
  return rows;
}

/** MLB season (single year). March–Dec -> this year; Jan/Feb -> last year. */
export function mlbSeason(now: Date = new Date()): number {
  const y = now.getFullYear();
  return now.getMonth() >= 2 ? y : y - 1;
}
