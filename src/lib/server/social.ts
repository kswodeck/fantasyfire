// Daily-leans selection for the social auto-publish pipeline (docs/MARKETING.md §3).
// ONE shared query path so the poster job (src/ingest/run-social.ts) and the card
// image route (/api/og/daily/[sport]) can never show different leans.
import { getBoard, getTonightSlate } from '@/lib/server/players';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

/** One publishable lean — the minimal, display-ready slice of a BoardRow. */
export interface DailyLean {
  slug: string;
  firstName: string;
  lastName: string;
  teamAbbreviation: string | null;
  statShort: string;
  line: number;
  side: 'over' | 'under';
  /** Only lean tiers are publishable — never "Slight lean" or below. */
  tier: 'Strong lean' | 'Lean';
}

const PUBLISHABLE_TIERS: ReadonlySet<string> = new Set(['Strong lean', 'Lean']);

/**
 * Today's strongest publishable leans for a sport, or [] when the sport has no
 * slate TODAY (off-season, or its next slate is days out — same gate as the home
 * page). Filtered to players whose team is actually on today's slate, capped to
 * one lean per player for variety, ranked by the board's FireFactor order.
 */
export async function getDailyLeans(sport: Sport, limit = 5): Promise<DailyLean[]> {
  const slate = await getTonightSlate(sport).catch(() => ({
    date: null as string | null,
    games: [],
  }));
  const todayIso = new Date().toISOString().slice(0, 10);
  if (slate.date !== todayIso || slate.games.length === 0) return [];

  const teams = new Set(
    slate.games
      .flatMap((g) => [g.home.abbr, g.away.abbr])
      .filter((a): a is string => !!a),
  );

  const rows = await getBoard(sport, { limit: 40 }).catch(() => [] as BoardRow[]);
  const seen = new Set<string>();
  const leans: DailyLean[] = [];
  for (const r of rows) {
    if (!PUBLISHABLE_TIERS.has(r.fireScore.tier)) continue;
    const abbr = r.player.teamAbbreviation ?? null;
    if (teams.size > 0 && (!abbr || !teams.has(abbr))) continue;
    if (seen.has(r.player.slug)) continue;
    seen.add(r.player.slug);
    leans.push({
      slug: r.player.slug,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      teamAbbreviation: abbr,
      statShort: r.statShort,
      line: r.line,
      side: r.fireScore.side,
      tier: r.fireScore.tier as DailyLean['tier'],
    });
    if (leans.length >= limit) break;
  }
  return leans;
}
