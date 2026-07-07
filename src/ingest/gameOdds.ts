// Pre-game Vegas odds from the ESPN scoreboard (idea #4). Every sport's scoreboard
// carries a `competitions[0].odds[]` array with the game total + spread; we pull it
// for ALL three sports (even MLB, whose SCHEDULE comes from statsapi) and the runner
// matches each line back to its ScheduledGame by team + date. No db here.
import type { Sport } from '../lib/sports';
import { normalizeNbaAbbr, normalizeNflAbbr } from './schedule';

export interface GameOddsRow {
  /** YYYY-MM-DD slate date (the queried date — the game's local day, matching how the
   *  schedule stores ScheduledGame.date), so series games stay distinct. */
  dateIso: string;
  homeAbbr: string;
  awayAbbr: string;
  /** ESPN team ids (as strings) — the reliable key for the ESPN-native sports,
   *  whose Team.externalId IS the ESPN id. Unused for NBA/MLB (different id space). */
  homeId: string | null;
  awayId: string | null;
  oddsProvider: string | null;
  /** Over/under (combined score). */
  gameTotal: number | null;
  /** Home-team-perspective spread (negative = home favored). */
  homeSpread: number | null;
  homeFavorite: boolean | null;
}

const ESPN_PATH: Record<Sport, string> = {
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nfl: 'football/nfl',
  nhl: 'hockey/nhl',
  wnba: 'basketball/wnba',
  mls: 'soccer/usa.1',
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FantasyFire/1.0 (+https://fantasyfire.app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function normAbbr(sport: Sport, a: string): string {
  if (sport === 'nba') return normalizeNbaAbbr(a);
  if (sport === 'nfl') return normalizeNflAbbr(a);
  return a.toUpperCase();
}

interface EspnOdds {
  provider?: { name?: string };
  overUnder?: number;
  spread?: number;
  homeTeamOdds?: { favorite?: boolean };
}
interface EspnCompetitor {
  homeAway?: string;
  team?: { id?: string; abbreviation?: string };
}
interface EspnEvent {
  date?: string;
  competitions?: {
    competitors?: EspnCompetitor[];
    odds?: EspnOdds[];
  }[];
}
interface EspnScoreboard {
  events?: EspnEvent[];
}

/** Game odds for one date (YYYY-MM-DD). Games without posted odds are skipped. */
export async function fetchEspnGameOdds(sport: Sport, date: string): Promise<GameOddsRow[]> {
  const data = (await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/scoreboard?dates=${date.replace(/-/g, '')}`,
  )) as EspnScoreboard;

  const out: GameOddsRow[] = [];
  for (const e of data.events ?? []) {
    const comp = e.competitions?.[0];
    const o = comp?.odds?.[0];
    if (!o || o.overUnder == null) continue;
    const home = comp?.competitors?.find((c) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c) => c.homeAway === 'away');
    if (!home?.team?.abbreviation || !away?.team?.abbreviation) continue;

    // Derive the home spread's SIGN from the favorite flag (robust to ESPN's
    // convention): the favorite gets the negative number.
    const absSpread = Number.isFinite(o.spread) ? Math.abs(Number(o.spread)) : null;
    const homeFavorite = o.homeTeamOdds?.favorite ?? null;
    const homeSpread =
      absSpread == null
        ? null
        : homeFavorite == null
          ? Number(o.spread)
          : homeFavorite
            ? -absSpread
            : absSpread;

    out.push({
      // Use the QUERIED date (the game's local slate day), not e.date (the UTC start,
      // which rolls to the next day for night games and would cross-match series).
      dateIso: date,
      homeAbbr: normAbbr(sport, home.team.abbreviation),
      awayAbbr: normAbbr(sport, away.team.abbreviation),
      homeId: home.team.id ? String(home.team.id) : null,
      awayId: away.team.id ? String(away.team.id) : null,
      oddsProvider: o.provider?.name ?? null,
      gameTotal: Number.isFinite(o.overUnder) ? Number(o.overUnder) : null,
      homeSpread,
      homeFavorite,
    });
  }
  return out;
}
