// Forgiving parser for a pasted "slate" of prop lines, so users can analyze
// their REAL book lines (not our derived median line). Pure (no React/Next/db).
// Each input line becomes a {name, stat, line, odds} guess; the server resolves
// the player + computes against the real number. Best-effort by design — it skips
// what it can't confidently read rather than guessing wrong.
import type { StatKey } from './stats';

export interface ParsedSlateEntry {
  raw: string;
  name: string;
  stat: StatKey | null;
  line: number | null;
  /** American odds for the over, when present. */
  odds: number | null;
}

// Most-specific aliases FIRST (combo stats before their parts), matched on word
// boundaries. Single ambiguous letters are avoided on purpose.
const STAT_ALIASES: Array<[StatKey, string[]]> = [
  ['pra', ['pra', 'pts+reb+ast', 'p+r+a', 'points rebounds assists', 'points+rebounds+assists']],
  ['pr', ['pr', 'pts+reb', 'p+r', 'points rebounds']],
  ['pa', ['pa', 'pts+ast', 'p+a', 'points assists']],
  ['ra', ['ra', 'reb+ast', 'r+a', 'rebounds assists']],
  ['stocks', ['stocks', 'stl+blk', 'steals blocks', 'steals+blocks']],
  ['oreb', ['oreb', 'offensive rebounds', 'off rebounds']],
  ['dreb', ['dreb', 'defensive rebounds', 'def rebounds']],
  ['fg3m', ['3pm', '3ptm', '3pt made', 'threes', 'three pointers', '3 pointers', '3-pointers', 'fg3m', '3s']],
  ['pts', ['points', 'point', 'pts']],
  ['reb', ['rebounds', 'rebound', 'rebs', 'reb', 'boards']],
  ['ast', ['assists', 'assist', 'asts', 'ast', 'dimes']],
  ['stl', ['steals', 'steal', 'stls', 'stl']],
  ['blk', ['blocks', 'block', 'blks', 'blk']],
  ['tov', ['turnovers', 'turnover', 'tov']],
  ['fouls', ['personal fouls', 'fouls', 'pf']],
  // MLB hitting
  ['hrr', ['h+r+rbi', 'hits runs rbis', 'hits+runs+rbis']],
  ['tb', ['total bases', 'total base', 'totalbases', 'bases', 'tb']],
  ['hr', ['home runs', 'home run', 'homeruns', 'homers', 'hr']],
  ['rbi', ['runs batted in', 'rbis', 'rbi']],
  ['doubles', ['doubles', 'double', '2b']],
  ['hits', ['hits', 'hit']],
  ['runs', ['runs scored', 'runs', 'run']],
  ['sb', ['stolen bases', 'stolen base', 'sb']],
  ['bb', ['bases on balls', 'walks', 'bb']],
  // MLB pitching
  ['k', ['pitcher strikeouts', 'strikeouts (pitcher)']],
  ['so', ['batter strikeouts', 'strikeouts', 'strikeout', 'ks', 'so']],
  ['er', ['earned runs', 'er']],
  ['outs', ['outs recorded', 'outs']],
  ['ha', ['hits allowed', 'ha']],
  ['bba', ['walks allowed', 'bba']],
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** First stat whose alias appears as a whole token in the text, else null. */
export function matchStat(text: string): StatKey | null {
  const padded = ` ${text.toLowerCase()} `;
  for (const [stat, aliases] of STAT_ALIASES) {
    for (const a of aliases) {
      if (new RegExp(`(?:^|[^a-z0-9])${escapeRe(a)}(?:[^a-z0-9]|$)`, 'i').test(padded)) {
        return stat;
      }
    }
  }
  return null;
}

/** Accent-fold + lowercase + collapse to a comparable name key. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasesFor(stat: StatKey): string[] {
  return STAT_ALIASES.find(([s]) => s === stat)?.[1] ?? [];
}

function parseEntry(raw: string): ParsedSlateEntry | null {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length < 2) return null;

  // Odds: an explicitly-signed 3-4 digit number (e.g. -110, +120). Remove it so
  // it isn't mistaken for the line.
  let odds: number | null = null;
  let work = ` ${text} `;
  const om = work.match(/(?:^|\s)([+-]\d{3,4})(?=\s|$)/);
  if (om) {
    odds = parseInt(om[1], 10);
    work = work.replace(om[1], ' ');
  }

  // Line: prefer a fractional number; else the first plausible (0 < n < 100).
  const nums = [...work.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/g)].map((m) => parseFloat(m[1]));
  const decimals = nums.filter((n) => !Number.isInteger(n));
  const small = nums.filter((n) => n > 0 && n < 100);
  const line = decimals.length ? decimals[0] : small.length ? small[0] : null;

  const stat = matchStat(text);

  // Name: strip numbers, over/under words, and the matched stat's aliases.
  let name = text.replace(/[+-]?\d+(?:\.\d+)?/g, ' ');
  name = name.replace(/\b(over|under|o\/u|more|less|higher|lower|vs\.?|@)\b/gi, ' ');
  if (stat) {
    for (const a of aliasesFor(stat)) {
      name = name.replace(new RegExp(`(?:^|[^a-z0-9])${escapeRe(a)}(?:[^a-z0-9]|$)`, 'gi'), ' ');
    }
  }
  name = name.replace(/[^A-Za-z .'À-ſ-]/g, ' ').replace(/\s+/g, ' ').trim();

  return { raw: text, name, stat, line, odds };
}

/** Parse a pasted slate (one entry per line). Blank/garbage lines are dropped. */
export function parseSlate(text: string): ParsedSlateEntry[] {
  return text
    .split(/\r?\n/)
    .map(parseEntry)
    .filter((e): e is ParsedSlateEntry => e !== null && e.name.length > 0);
}
