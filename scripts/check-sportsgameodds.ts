// THROWAWAY diagnostic — confirm SportsGameOdds coverage + statID spellings on the
// FREE tier before wiring the real ingest on. Safe to delete after.
//
//   SPORTSGAMEODDS_API_KEY=sk_... tsx scripts/check-sportsgameodds.ts
//   (or put the key in .env — this loads dotenv)
//
// Free tier = 10 req/min, ~1000 objects/month, billed PER EVENT. This makes one
// small request per league (limit=2 events) → ~6 objects total. It prints, per
// league: event count, the distinct player-prop statIDs (and whether our
// SGO_STAT_MAP resolves each), the books present (flagging the DFS pick'em ones),
// and a sample prop with its per-book lines.
import 'dotenv/config';
import { SGO_LEAGUE, SGO_STAT_MAP } from '../src/ingest/sportsgameodds';
import type { Sport } from '../src/lib/sports';

const BASE = 'https://api.sportsgameodds.com/v2';
const API_KEY = process.env.SPORTSGAMEODDS_API_KEY ?? '';
const DFS_BOOKS = ['prizepicks', 'underdog', 'sleeper', 'draftkings'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OddLite {
  statID?: string;
  statEntityID?: string;
  periodID?: string;
  betTypeID?: string;
  sideID?: string;
  marketName?: string;
  byBookmaker?: Record<string, { overUnder?: string }>;
}
interface EventLite {
  odds?: Record<string, OddLite>;
}

async function checkLeague(sport: Sport): Promise<void> {
  const league = SGO_LEAGUE[sport];
  const qs = new URLSearchParams({ leagueID: league, oddsAvailable: 'true', limit: '2' });
  const res = await fetch(`${BASE}/events?${qs.toString()}`, {
    headers: { 'X-Api-Key': API_KEY, Accept: 'application/json' },
  });
  console.log(`\n=== ${league} (HTTP ${res.status}) ===`);
  if (!res.ok) {
    console.log(`  request failed: ${await res.text().catch(() => '')}`.slice(0, 300));
    return;
  }
  const body = (await res.json()) as { data?: EventLite[] };
  const events = body.data ?? [];
  console.log(`  events returned: ${events.length}`);

  const statIds = new Map<string, string>(); // statID -> sample marketName
  const books = new Set<string>();
  let sample: string | null = null;
  let sampleBooks: Record<string, string> = {};

  for (const ev of events) {
    for (const [oddID, odd] of Object.entries(ev.odds ?? {})) {
      if (odd.periodID !== 'game' || odd.betTypeID !== 'ou' || odd.sideID !== 'over') continue;
      const isPlayer = odd.statEntityID && !['home', 'away', 'all'].includes(odd.statEntityID);
      if (!isPlayer) continue;
      if (odd.statID) statIds.set(odd.statID, odd.marketName ?? '');
      const byBook = odd.byBookmaker ?? {};
      for (const b of Object.keys(byBook)) books.add(b);
      if (!sample) {
        sample = oddID;
        sampleBooks = Object.fromEntries(
          Object.entries(byBook).map(([k, v]) => [k, String(v.overUnder ?? '?')]),
        );
      }
    }
  }

  const map = SGO_STAT_MAP[sport];
  const mapped: string[] = [];
  const unmapped: string[] = [];
  for (const [id, name] of statIds) (map[id] ? mapped : unmapped).push(`${id}${name ? ` (${name})` : ''}`);

  console.log(`  player-prop statIDs: ${statIds.size}`);
  console.log(`    ✓ mapped:   ${mapped.map((m) => m.split(' ')[0] + '→' + map[m.split(' ')[0]]).join(', ') || '(none)'}`);
  console.log(`    ✗ UNMAPPED: ${unmapped.join(', ') || '(none)'}`);

  const present = DFS_BOOKS.filter((b) => books.has(b));
  const pick6 = [...books].filter((b) => /pick.?6/i.test(b));
  console.log(`  books present (${books.size}): ${[...books].sort().join(', ') || '(none)'}`);
  console.log(`    DFS pick'em present: ${present.join(', ') || 'NONE'}${pick6.length ? ` | pick6-like: ${pick6.join(', ')}` : ''}`);
  if (sample) console.log(`  sample prop: ${sample}\n    lines: ${JSON.stringify(sampleBooks)}`);
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error('Set SPORTSGAMEODDS_API_KEY (env or .env) first. Get a free key at sportsgameodds.com.');
    process.exit(1);
  }
  for (const sport of ['nba', 'mlb', 'nfl'] as Sport[]) {
    await checkLeague(sport);
    await sleep(1500); // be gentle on the rate limit
  }
  console.log('\nDone. Update SGO_STAT_MAP in src/ingest/sportsgameodds.ts for any ✗ UNMAPPED statIDs you want.');
}

main();
