// Team branding + official image URLs, per sport.
//
// REAL / deterministic images, keyed by the external id we already store:
//   NBA headshot: cdn.nba.com/headshots/nba/latest/{size}/{personId}.png
//   NBA logo:     cdn.nba.com/logos/nba/{teamId}/primary/L/logo.svg
//   MLB headshot: midfield.mlbstatic.com/v1/people/{personId}/spots/{px}
//   MLB logo:     www.mlbstatic.com/team-logos/{teamId}.svg
//
// CURATED / static: full names, cities, and brand colors aren't in a free feed,
// so these are hand-maintained 30-team tables of public brand data. `primary` is
// the accent we display (picked to read on the dark UI); `secondary` adds depth.
// Pure module — no React/Next/db imports.
import type { Sport } from './sports';

export interface TeamBrand {
  abbr: string;
  name: string; // nickname, e.g. "Knicks"
  city: string; // e.g. "New York"
  fullName: string; // "New York Knicks"
  primary: string; // display accent (hex)
  secondary: string; // hex
}

type Entry = Omit<TeamBrand, 'abbr' | 'fullName'>;

const NBA_TEAMS: Record<string, Entry> = {
  ATL: { name: 'Hawks', city: 'Atlanta', primary: '#E03A3E', secondary: '#26282A' },
  BKN: { name: 'Nets', city: 'Brooklyn', primary: '#D7D7D7', secondary: '#000000' },
  BOS: { name: 'Celtics', city: 'Boston', primary: '#1CA85B', secondary: '#BB9753' },
  CHA: { name: 'Hornets', city: 'Charlotte', primary: '#00A2B3', secondary: '#1D1160' },
  CHI: { name: 'Bulls', city: 'Chicago', primary: '#CE1141', secondary: '#000000' },
  CLE: { name: 'Cavaliers', city: 'Cleveland', primary: '#FDBB30', secondary: '#860038' },
  DAL: { name: 'Mavericks', city: 'Dallas', primary: '#0072CE', secondary: '#002B5E' },
  DEN: { name: 'Nuggets', city: 'Denver', primary: '#FEC524', secondary: '#0E2240' },
  DET: { name: 'Pistons', city: 'Detroit', primary: '#C8102E', secondary: '#1D42BA' },
  GSW: { name: 'Warriors', city: 'Golden State', primary: '#FDB927', secondary: '#1D428A' },
  HOU: { name: 'Rockets', city: 'Houston', primary: '#CE1141', secondary: '#C4CED4' },
  IND: { name: 'Pacers', city: 'Indiana', primary: '#FDBB30', secondary: '#002D62' },
  LAC: { name: 'Clippers', city: 'LA', primary: '#C8102E', secondary: '#1D428A' },
  LAL: { name: 'Lakers', city: 'Los Angeles', primary: '#FDB927', secondary: '#552583' },
  MEM: { name: 'Grizzlies', city: 'Memphis', primary: '#5D76A9', secondary: '#12173F' },
  MIA: { name: 'Heat', city: 'Miami', primary: '#F9A01B', secondary: '#98002E' },
  MIL: { name: 'Bucks', city: 'Milwaukee', primary: '#00843D', secondary: '#EEE1C6' },
  MIN: { name: 'Timberwolves', city: 'Minnesota', primary: '#78BE20', secondary: '#0C2340' },
  NOP: { name: 'Pelicans', city: 'New Orleans', primary: '#C8102E', secondary: '#0C2340' },
  NYK: { name: 'Knicks', city: 'New York', primary: '#F58426', secondary: '#006BB6' },
  OKC: { name: 'Thunder', city: 'Oklahoma City', primary: '#007AC1', secondary: '#EF3B24' },
  ORL: { name: 'Magic', city: 'Orlando', primary: '#0077C0', secondary: '#C4CED4' },
  PHI: { name: '76ers', city: 'Philadelphia', primary: '#006BB6', secondary: '#ED174C' },
  PHX: { name: 'Suns', city: 'Phoenix', primary: '#E56020', secondary: '#1D1160' },
  POR: { name: 'Trail Blazers', city: 'Portland', primary: '#E03A3E', secondary: '#C4CED4' },
  SAC: { name: 'Kings', city: 'Sacramento', primary: '#7A57C2', secondary: '#63727A' },
  SAS: { name: 'Spurs', city: 'San Antonio', primary: '#C4CED4', secondary: '#000000' },
  TOR: { name: 'Raptors', city: 'Toronto', primary: '#CE1141', secondary: '#000000' },
  UTA: { name: 'Jazz', city: 'Utah', primary: '#F9A01B', secondary: '#002B5C' },
  WAS: { name: 'Wizards', city: 'Washington', primary: '#E31837', secondary: '#002B5C' },
};

const MLB_TEAMS: Record<string, Entry> = {
  ATH: { name: 'Athletics', city: '', primary: '#EFB21E', secondary: '#003831' },
  ATL: { name: 'Braves', city: 'Atlanta', primary: '#CE1141', secondary: '#13274F' },
  AZ: { name: 'Diamondbacks', city: 'Arizona', primary: '#A71930', secondary: '#30CED8' },
  BAL: { name: 'Orioles', city: 'Baltimore', primary: '#DF4601', secondary: '#000000' },
  BOS: { name: 'Red Sox', city: 'Boston', primary: '#BD3039', secondary: '#0C2340' },
  CHC: { name: 'Cubs', city: 'Chicago', primary: '#2A6FCB', secondary: '#CC3433' },
  CIN: { name: 'Reds', city: 'Cincinnati', primary: '#C6011F', secondary: '#000000' },
  CLE: { name: 'Guardians', city: 'Cleveland', primary: '#E50022', secondary: '#0C2340' },
  COL: { name: 'Rockies', city: 'Colorado', primary: '#8E6FB6', secondary: '#C4CED4' },
  CWS: { name: 'White Sox', city: 'Chicago', primary: '#C4CED4', secondary: '#000000' },
  DET: { name: 'Tigers', city: 'Detroit', primary: '#FA4616', secondary: '#0C2340' },
  HOU: { name: 'Astros', city: 'Houston', primary: '#EB6E1F', secondary: '#002D62' },
  KC: { name: 'Royals', city: 'Kansas City', primary: '#4F9BE0', secondary: '#BD9B60' },
  LAA: { name: 'Angels', city: 'Los Angeles', primary: '#BA0021', secondary: '#003263' },
  LAD: { name: 'Dodgers', city: 'Los Angeles', primary: '#3F8FD2', secondary: '#EF3E42' },
  MIA: { name: 'Marlins', city: 'Miami', primary: '#00A3E0', secondary: '#FF6600' },
  MIL: { name: 'Brewers', city: 'Milwaukee', primary: '#FFC52F', secondary: '#12284B' },
  MIN: { name: 'Twins', city: 'Minnesota', primary: '#D31145', secondary: '#002B5C' },
  NYM: { name: 'Mets', city: 'New York', primary: '#FF5910', secondary: '#002D72' },
  NYY: { name: 'Yankees', city: 'New York', primary: '#7CA2D6', secondary: '#0C2340' },
  PHI: { name: 'Phillies', city: 'Philadelphia', primary: '#E81828', secondary: '#284898' },
  PIT: { name: 'Pirates', city: 'Pittsburgh', primary: '#FDB827', secondary: '#27251F' },
  SD: { name: 'Padres', city: 'San Diego', primary: '#FFC425', secondary: '#2F241D' },
  SEA: { name: 'Mariners', city: 'Seattle', primary: '#4FA8A0', secondary: '#0C2C56' },
  SF: { name: 'Giants', city: 'San Francisco', primary: '#FD5A1E', secondary: '#27251F' },
  STL: { name: 'Cardinals', city: 'St. Louis', primary: '#C41E3A', secondary: '#0C2340' },
  TB: { name: 'Rays', city: 'Tampa Bay', primary: '#8FBCE6', secondary: '#092C5C' },
  TEX: { name: 'Rangers', city: 'Texas', primary: '#C0111F', secondary: '#003278' },
  TOR: { name: 'Blue Jays', city: 'Toronto', primary: '#2F7FD1', secondary: '#1D2D5C' },
  WSH: { name: 'Nationals', city: 'Washington', primary: '#AB0003', secondary: '#14225A' },
};

const TABLES: Record<Sport, Record<string, Entry>> = { nba: NBA_TEAMS, mlb: MLB_TEAMS };

const FALLBACK: TeamBrand = {
  abbr: '',
  name: '',
  city: '',
  fullName: '',
  primary: '#ea580c', // brand orange
  secondary: '#78716c',
};

/** Brand info for a team abbreviation in a sport, or a neutral fallback. */
export function getTeam(sport: Sport, abbr: string | null | undefined): TeamBrand {
  if (!abbr) return FALLBACK;
  const t = TABLES[sport]?.[abbr];
  if (!t) return { ...FALLBACK, abbr };
  return { abbr, fullName: `${t.city} ${t.name}`.trim(), ...t };
}

export type HeadshotSize = 'sm' | 'lg';

/** Official headshot URL for a player's external id. Missing ids return a silhouette. */
export function playerHeadshotUrl(sport: Sport, externalId: number, size: HeadshotSize = 'sm'): string {
  if (sport === 'mlb') {
    const px = size === 'lg' ? '240' : '120';
    return `https://midfield.mlbstatic.com/v1/people/${externalId}/spots/${px}`;
  }
  const px = size === 'lg' ? '1040x760' : '260x190';
  return `https://cdn.nba.com/headshots/nba/latest/${px}/${externalId}.png`;
}

/** Official team logo (SVG) for a team's external id. */
export function teamLogoUrl(sport: Sport, externalId: number): string {
  if (sport === 'mlb') {
    return `https://www.mlbstatic.com/team-logos/${externalId}.svg`;
  }
  return `https://cdn.nba.com/logos/nba/${externalId}/primary/L/logo.svg`;
}

/** Black or white text that reads on the given hex background. */
export function readableTextColor(hex: string): '#ffffff' | '#1c1917' {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived brightness (ITU-R BT.601).
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#1c1917' : '#ffffff';
}
