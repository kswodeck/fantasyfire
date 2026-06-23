// src/ingest/nba/matchup.ts
//
// Parses the NBA MATCHUP string from a game log row.
//   "BOS vs. LAL" -> home game vs LAL
//   "BOS @ LAL"   -> away game at LAL

export interface ParsedMatchup {
  teamAbbreviation: string;
  opponentAbbreviation: string;
  isHome: boolean;
}

export function parseMatchup(matchup: string): ParsedMatchup {
  const raw = (matchup ?? '').trim();

  // Away marker: " @ "
  if (raw.includes('@')) {
    const [team, opp] = raw.split('@').map((s) => s.trim());
    if (team && opp) {
      return { teamAbbreviation: team, opponentAbbreviation: opp, isHome: false };
    }
  }

  // Home marker: " vs. " (also tolerate "vs ")
  const parts = raw.split(/\s+vs\.?\s+/i);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return {
      teamAbbreviation: parts[0].trim(),
      opponentAbbreviation: parts[1].trim(),
      isHome: true,
    };
  }

  throw new Error(`Unrecognized MATCHUP format: "${matchup}"`);
}
