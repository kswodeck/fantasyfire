// ESPN hidden-endpoint client — the documented fallback for when stats.nba.com
// IP-blocks the runner. ESPN rarely blocks datacenter IPs. It uses its OWN
// athlete/game ids (NOT NBA PERSON_ID/GAME_ID), so the orchestrator reconciles
// players by name+team and games by matchup key (see espn-fallback.ts). No db
// here.
import { normalizeNbaAbbr } from './schedule';

export interface EspnBoxRow {
  playerName: string;
  teamAbbr: string;
  opponentAbbr: string;
  isHome: boolean;
  gameDate: string; // YYYY-MM-DD
  eventId: string;
  minutes: number | null;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pts: number;
  plusMinus: number | null;
}

const SCOREBOARD = (d: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}`;
const SUMMARY = (id: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FantasyFire/1.0 (+https://fantasyfire.app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function intOr(s: string | undefined, fallback = 0): number {
  const n = parseInt(s ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}
/** Parse "made-attempted" (e.g. "12-22") to [made, attempted]. */
function madeAtt(s: string | undefined): [number, number] {
  const parts = (s ?? '').split('-');
  return [intOr(parts[0]), intOr(parts[1])];
}

type AthleteStats = Omit<
  EspnBoxRow,
  'playerName' | 'teamAbbr' | 'opponentAbbr' | 'isHome' | 'gameDate' | 'eventId'
>;

/**
 * Map one ESPN athlete's stat array (aligned to `names`) to our box fields.
 * Pure + unit-tested. ESPN names: MIN PTS FG 3PT FT REB AST TO STL BLK OREB DREB PF +/-.
 */
export function parseEspnAthlete(names: string[], stats: string[]): AthleteStats {
  const at = (name: string): string | undefined => {
    const i = names.indexOf(name);
    return i >= 0 ? stats[i] : undefined;
  };
  const [fgm, fga] = madeAtt(at('FG'));
  const [fg3m, fg3a] = madeAtt(at('3PT'));
  const [ftm, fta] = madeAtt(at('FT'));
  const min = at('MIN');
  const pm = at('+/-');
  return {
    minutes: min == null || min === '' ? null : intOr(min),
    fgm,
    fga,
    fg3m,
    fg3a,
    ftm,
    fta,
    oreb: intOr(at('OREB')),
    dreb: intOr(at('DREB')),
    reb: intOr(at('REB')),
    ast: intOr(at('AST')),
    stl: intOr(at('STL')),
    blk: intOr(at('BLK')),
    tov: intOr(at('TO')),
    pf: intOr(at('PF')),
    pts: intOr(at('PTS')),
    plusMinus: pm == null || pm === '' ? null : intOr(pm.replace('+', '')),
  };
}

interface EspnSummary {
  boxscore?: {
    players?: {
      team?: { abbreviation?: string };
      statistics?: {
        names?: string[];
        athletes?: { athlete?: { displayName?: string }; didNotPlay?: boolean; stats?: string[] }[];
      }[];
    }[];
  };
  header?: {
    competitions?: { competitors?: { homeAway?: string; team?: { abbreviation?: string } }[] }[];
  };
}
interface EspnScoreboard {
  events?: { id?: string | number; competitions?: { status?: { type?: { state?: string } } }[] }[];
}

/** Completed-game box scores for one date (YYYY-MM-DD), normalized to EspnBoxRow. */
export async function fetchEspnNbaBoxScores(date: string): Promise<EspnBoxRow[]> {
  const sb = (await getJson(SCOREBOARD(date.replace(/-/g, '')))) as EspnScoreboard;
  const events = (sb.events ?? []).filter(
    (e) => e.competitions?.[0]?.status?.type?.state === 'post',
  );

  const rows: EspnBoxRow[] = [];
  for (const e of events) {
    const eventId = String(e.id);
    let sum: EspnSummary;
    try {
      sum = (await getJson(SUMMARY(eventId))) as EspnSummary;
    } catch {
      continue; // skip a single bad game, keep the rest
    }
    const competitors = sum.header?.competitions?.[0]?.competitors ?? [];
    const homeAwayByAbbr = new Map(
      competitors.map((c) => [normalizeNbaAbbr(c.team?.abbreviation ?? ''), c.homeAway]),
    );
    const abbrs = [...homeAwayByAbbr.keys()];

    for (const tb of sum.boxscore?.players ?? []) {
      const teamAbbr = normalizeNbaAbbr(tb.team?.abbreviation ?? '');
      const opponentAbbr = abbrs.find((a) => a !== teamAbbr) ?? '';
      const isHome = homeAwayByAbbr.get(teamAbbr) === 'home';
      const block = tb.statistics?.[0];
      const names = block?.names ?? [];
      for (const a of block?.athletes ?? []) {
        if (a.didNotPlay) continue;
        const playerName = a.athlete?.displayName;
        if (!playerName || !a.stats || a.stats.length === 0) continue;
        rows.push({
          playerName,
          teamAbbr,
          opponentAbbr,
          isHome,
          gameDate: date,
          eventId,
          ...parseEspnAthlete(names, a.stats),
        });
      }
    }
    // Be polite to the unofficial endpoint.
    await new Promise((r) => setTimeout(r, 200));
  }
  return rows;
}
