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
  /** Finer status from details.fantasyStatus (GTD / Probable / IL tier); else rawStatus. */
  fantasyStatus: string | null;
  /** Assembled injury, e.g. "Right Ankle Sprain". */
  detail: string | null;
  /** Estimated return date (ISO), when ESPN gives one. */
  returnDate: string | null;
  comment: string | null; // shortComment
  news: string | null; // longComment
  reportedAt: string | null; // ISO timestamp
}

const ESPN_PATH: Record<Sport, string> = {
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nfl: 'football/nfl',
  nhl: 'hockey/nhl',
  wnba: 'basketball/wnba',
  mls: 'soccer/usa.1',
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

interface EspnInjuryDetails {
  fantasyStatus?: { description?: string; abbreviation?: string };
  type?: string; // body area, e.g. "Ankle" / "Lower Body"
  location?: string; // e.g. "Leg"
  detail?: string; // e.g. "Sprain"
  side?: string; // e.g. "Right"
  returnDate?: string; // ISO date
}
interface EspnInjuryItem {
  status?: string;
  date?: string;
  athlete?: { displayName?: string };
  shortComment?: string;
  longComment?: string;
  details?: EspnInjuryDetails;
}
interface EspnInjuriesResponse {
  injuries?: { injuries?: EspnInjuryItem[] }[];
}

/** Assemble a human injury string from the structured parts, e.g. "Right Ankle Sprain". */
function assembleInjury(d: EspnInjuryDetails | undefined): string | null {
  if (!d) return null;
  const s = [d.side, d.type ?? d.location, d.detail].filter(Boolean).join(' ').trim();
  return s || null;
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
        // The finer fantasy designation (GTD / Probable / IL tier); for NFL (no details)
        // ESPN's top-level status (Questionable / Out) IS the fantasy-relevant one.
        fantasyStatus: it.details?.fantasyStatus?.description ?? it.status ?? null,
        detail: assembleInjury(it.details),
        returnDate: it.details?.returnDate ?? null,
        comment: it.shortComment ?? null,
        news: it.longComment ?? null,
        reportedAt: it.date ?? null,
      });
    }
  }
  return out;
}
