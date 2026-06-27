// Current injury / availability from the public ESPN injuries feed (idea #5):
//   GET https://site.api.espn.com/apis/site/v2/sports/<league>/injuries
// Shape: { injuries: [ { displayName(team), injuries: [ { status, date, athlete{displayName},
//          type{description}, shortComment } ] } ] }. No db here — the runner matches
// athlete names to our players and upserts PlayerInjury.
import type { Sport } from '../lib/sports';

/** Normalized availability buckets. `out` covers every flavor of not-playing (IL,
 *  suspension, paternity, …); the rest are game-time-decision tiers. */
export type InjuryStatus = 'out' | 'doubtful' | 'questionable' | 'day-to-day';

export interface InjuryRow {
  externalName: string; // athlete displayName, matched to our Player by name
  rawStatus: string; // ESPN's original status string
  status: InjuryStatus;
  detail: string | null; // body part / injury type
  comment: string | null;
  reportedAt: string | null; // ISO timestamp
}

const ESPN_PATH: Record<Sport, string> = {
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nfl: 'football/nfl',
};

/** Map ESPN's many status strings to our four buckets. */
export function normalizeInjuryStatus(raw: string): InjuryStatus {
  const s = raw.toLowerCase();
  if (s.includes('doubtful')) return 'doubtful';
  if (s.includes('questionable')) return 'questionable';
  if (s.includes('day-to-day') || s.includes('day to day')) return 'day-to-day';
  // Everything else — IL variants, "Out", suspension, paternity, developmental — is
  // a player who is not available.
  return 'out';
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FantasyFire/1.0 (+https://fantasyfire.app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

interface EspnInjuryItem {
  status?: string;
  date?: string;
  athlete?: { displayName?: string };
  type?: { description?: string };
  shortComment?: string;
}
interface EspnInjuriesResponse {
  injuries?: { injuries?: EspnInjuryItem[] }[];
}

export async function fetchEspnInjuries(sport: Sport): Promise<InjuryRow[]> {
  const data = (await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[sport]}/injuries`,
  )) as EspnInjuriesResponse;

  const out: InjuryRow[] = [];
  for (const group of data.injuries ?? []) {
    for (const it of group.injuries ?? []) {
      const name = it.athlete?.displayName?.trim();
      if (!name || !it.status) continue;
      out.push({
        externalName: name,
        rawStatus: it.status,
        status: normalizeInjuryStatus(it.status),
        detail: it.type?.description ?? null,
        comment: it.shortComment ?? null,
        reportedAt: it.date ?? null,
      });
    }
  }
  return out;
}
