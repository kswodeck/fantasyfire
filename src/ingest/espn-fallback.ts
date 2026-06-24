// ESPN fallback orchestration: turn ESPN box scores into PlayerGameStat rows
// SAFELY despite ESPN using its own ids.
//   - Teams resolve by abbreviation.
//   - Players resolve by normalized name (+ team); AMBIGUOUS matches are SKIPPED,
//     never guessed, so we can't mis-attribute a stat.
//   - Games are keyed by matchup (`espn:{date}:{away}:{home}`). cleanupEspnDuplicates()
//     deletes an ESPN fill-in once the canonical stats.nba.com game for the same
//     matchup exists, so the two sources never double-count.
import { db } from '../lib/db';
import { fetchEspnNbaBoxScores, type EspnBoxRow } from './espn';

function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** NBA season string ("2025-26") for a date — Oct..June spans year..year+1. */
function nbaSeasonForDate(dateIso: string): string {
  const [y, m] = dateIso.split('-').map(Number);
  return m >= 10
    ? `${y}-${String((y + 1) % 100).padStart(2, '0')}`
    : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

/** The last `days` dates (ET), most recent first. */
function recentEtDates(days: number): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const out: string[] = [];
  for (let i = 1; i <= days; i++) out.push(fmt.format(new Date(Date.now() - i * 86_400_000)));
  return out;
}

export async function ingestEspnNbaFallback(
  days = 5,
): Promise<{ rows: number; written: number; unmatched: number }> {
  const boxRows: EspnBoxRow[] = [];
  for (const date of recentEtDates(days)) {
    try {
      boxRows.push(...(await fetchEspnNbaBoxScores(date)));
    } catch (e) {
      console.warn(`[espn] ${date} failed: ${(e as Error).message}`);
    }
  }
  if (boxRows.length === 0) return { rows: 0, written: 0, unmatched: 0 };

  const teams = await db.team.findMany({
    where: { sport: 'nba' },
    select: { id: true, abbreviation: true },
  });
  const teamIdByAbbr = new Map(teams.map((t) => [t.abbreviation, t.id]));

  const players = await db.player.findMany({
    where: { sport: 'nba' },
    select: { id: true, firstName: true, lastName: true, team: { select: { abbreviation: true } } },
  });
  const byName = new Map<string, number[]>();
  const byNameTeam = new Map<string, number>();
  for (const p of players) {
    const n = normName(`${p.firstName} ${p.lastName}`);
    const list = byName.get(n);
    if (list) list.push(p.id);
    else byName.set(n, [p.id]);
    if (p.team?.abbreviation) byNameTeam.set(`${n}|${p.team.abbreviation}`, p.id);
  }
  const resolvePlayer = (name: string, teamAbbr: string): number | null => {
    const n = normName(name);
    const nt = byNameTeam.get(`${n}|${teamAbbr}`);
    if (nt) return nt;
    const cands = byName.get(n);
    return cands && cands.length === 1 ? cands[0] : null; // skip ambiguous/unknown
  };

  const gameIdByExternal = new Map<string, number>();
  let written = 0;
  let unmatched = 0;

  for (const r of boxRows) {
    const teamId = teamIdByAbbr.get(r.teamAbbr);
    const opponentTeamId = teamIdByAbbr.get(r.opponentAbbr);
    const playerId = resolvePlayer(r.playerName, r.teamAbbr);
    if (!teamId || !opponentTeamId || !playerId) {
      unmatched++;
      continue;
    }

    const homeTeamId = r.isHome ? teamId : opponentTeamId;
    const awayTeamId = r.isHome ? opponentTeamId : teamId;
    const homeAbbr = r.isHome ? r.teamAbbr : r.opponentAbbr;
    const awayAbbr = r.isHome ? r.opponentAbbr : r.teamAbbr;
    const externalId = `espn:${r.gameDate.replace(/-/g, '')}:${awayAbbr}:${homeAbbr}`;
    const season = nbaSeasonForDate(r.gameDate);
    const date = new Date(`${r.gameDate}T00:00:00Z`);

    let gameId = gameIdByExternal.get(externalId);
    if (gameId == null) {
      const existing = await db.game.findFirst({
        where: { sport: 'nba', date, homeTeamId, awayTeamId },
        select: { id: true },
      });
      gameId =
        existing?.id ??
        (
          await db.game.create({
            data: { sport: 'nba', externalId, date, season, homeTeamId, awayTeamId },
            select: { id: true },
          })
        ).id;
      gameIdByExternal.set(externalId, gameId);
    }

    const box = {
      minutes: r.minutes,
      points: r.pts,
      rebounds: r.reb,
      oreb: r.oreb,
      dreb: r.dreb,
      assists: r.ast,
      steals: r.stl,
      blocks: r.blk,
      turnovers: r.tov,
      fouls: r.pf,
      fgm: r.fgm,
      fga: r.fga,
      fg3m: r.fg3m,
      fg3a: r.fg3a,
      ftm: r.ftm,
      fta: r.fta,
      plusMinus: r.plusMinus,
    };
    await db.playerGameStat.upsert({
      where: { playerId_gameId: { playerId, gameId } },
      create: { sport: 'nba', playerId, gameId, teamId, opponentTeamId, isHome: r.isHome, season, gameDate: date, ...box },
      update: box,
    });
    written++;
  }

  console.log(`[espn] ${boxRows.length} box rows → ${written} stats written, ${unmatched} unmatched (skipped)`);
  return { rows: boxRows.length, written, unmatched };
}

/**
 * Remove ESPN fill-in games once the canonical stats.nba.com game for the same
 * matchup exists — so the two sources never double-count. Safe to run anytime.
 */
export async function cleanupEspnDuplicates(): Promise<number> {
  const espnGames = await db.game.findMany({
    where: { sport: 'nba', externalId: { startsWith: 'espn:' } },
    select: { id: true, date: true, homeTeamId: true, awayTeamId: true },
  });
  let removed = 0;
  for (const g of espnGames) {
    const canonical = await db.game.findFirst({
      where: {
        sport: 'nba',
        date: g.date,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        externalId: { not: { startsWith: 'espn:' } },
      },
      select: { id: true },
    });
    if (!canonical) continue;
    await db.playerGameStat.deleteMany({ where: { gameId: g.id } });
    await db.game.delete({ where: { id: g.id } });
    removed++;
  }
  if (removed) console.log(`[espn] cleanup removed ${removed} duplicate fill-in game(s)`);
  return removed;
}
