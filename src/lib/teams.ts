// Team branding + official NBA image URLs.
//
// REAL / deterministic: player headshots and team logos come straight off the NBA
// CDN, keyed by the PERSON_ID / TEAM_ID we already store. No extra ingest needed.
//   headshot: cdn.nba.com/headshots/nba/latest/{size}/{personId}.png
//   logo:     cdn.nba.com/logos/nba/{teamId}/primary/L/logo.svg
//
// CURATED / static: full names, cities, and brand colors aren't in a free NBA feed,
// so this is a hand-maintained 30-team table of public brand data. `primary` is the
// accent we display (chosen to read well on the dark UI); `secondary` adds depth.
// Pure module — no React/Next/db imports.

export interface TeamBrand {
  abbr: string;
  nbaId: number; // TEAM_ID, for the logo URL (verified against our DB)
  name: string; // e.g. "Knicks"
  city: string; // e.g. "New York"
  fullName: string; // "New York Knicks"
  primary: string; // display accent (hex)
  secondary: string; // hex
}

type Entry = Omit<TeamBrand, 'abbr' | 'fullName'>;

const TEAMS: Record<string, Entry> = {
  ATL: { nbaId: 1610612737, name: 'Hawks', city: 'Atlanta', primary: '#E03A3E', secondary: '#26282A' },
  BKN: { nbaId: 1610612751, name: 'Nets', city: 'Brooklyn', primary: '#D7D7D7', secondary: '#000000' },
  BOS: { nbaId: 1610612738, name: 'Celtics', city: 'Boston', primary: '#1CA85B', secondary: '#BB9753' },
  CHA: { nbaId: 1610612766, name: 'Hornets', city: 'Charlotte', primary: '#00A2B3', secondary: '#1D1160' },
  CHI: { nbaId: 1610612741, name: 'Bulls', city: 'Chicago', primary: '#CE1141', secondary: '#000000' },
  CLE: { nbaId: 1610612739, name: 'Cavaliers', city: 'Cleveland', primary: '#FDBB30', secondary: '#860038' },
  DAL: { nbaId: 1610612742, name: 'Mavericks', city: 'Dallas', primary: '#0072CE', secondary: '#002B5E' },
  DEN: { nbaId: 1610612743, name: 'Nuggets', city: 'Denver', primary: '#FEC524', secondary: '#0E2240' },
  DET: { nbaId: 1610612765, name: 'Pistons', city: 'Detroit', primary: '#C8102E', secondary: '#1D42BA' },
  GSW: { nbaId: 1610612744, name: 'Warriors', city: 'Golden State', primary: '#FDB927', secondary: '#1D428A' },
  HOU: { nbaId: 1610612745, name: 'Rockets', city: 'Houston', primary: '#CE1141', secondary: '#C4CED4' },
  IND: { nbaId: 1610612754, name: 'Pacers', city: 'Indiana', primary: '#FDBB30', secondary: '#002D62' },
  LAC: { nbaId: 1610612746, name: 'Clippers', city: 'LA', primary: '#C8102E', secondary: '#1D428A' },
  LAL: { nbaId: 1610612747, name: 'Lakers', city: 'Los Angeles', primary: '#FDB927', secondary: '#552583' },
  MEM: { nbaId: 1610612763, name: 'Grizzlies', city: 'Memphis', primary: '#5D76A9', secondary: '#12173F' },
  MIA: { nbaId: 1610612748, name: 'Heat', city: 'Miami', primary: '#F9A01B', secondary: '#98002E' },
  MIL: { nbaId: 1610612749, name: 'Bucks', city: 'Milwaukee', primary: '#00843D', secondary: '#EEE1C6' },
  MIN: { nbaId: 1610612750, name: 'Timberwolves', city: 'Minnesota', primary: '#78BE20', secondary: '#0C2340' },
  NOP: { nbaId: 1610612740, name: 'Pelicans', city: 'New Orleans', primary: '#C8102E', secondary: '#0C2340' },
  NYK: { nbaId: 1610612752, name: 'Knicks', city: 'New York', primary: '#F58426', secondary: '#006BB6' },
  OKC: { nbaId: 1610612760, name: 'Thunder', city: 'Oklahoma City', primary: '#007AC1', secondary: '#EF3B24' },
  ORL: { nbaId: 1610612753, name: 'Magic', city: 'Orlando', primary: '#0077C0', secondary: '#C4CED4' },
  PHI: { nbaId: 1610612755, name: '76ers', city: 'Philadelphia', primary: '#006BB6', secondary: '#ED174C' },
  PHX: { nbaId: 1610612756, name: 'Suns', city: 'Phoenix', primary: '#E56020', secondary: '#1D1160' },
  POR: { nbaId: 1610612757, name: 'Trail Blazers', city: 'Portland', primary: '#E03A3E', secondary: '#C4CED4' },
  SAC: { nbaId: 1610612758, name: 'Kings', city: 'Sacramento', primary: '#7A57C2', secondary: '#63727A' },
  SAS: { nbaId: 1610612759, name: 'Spurs', city: 'San Antonio', primary: '#C4CED4', secondary: '#000000' },
  TOR: { nbaId: 1610612761, name: 'Raptors', city: 'Toronto', primary: '#CE1141', secondary: '#000000' },
  UTA: { nbaId: 1610612762, name: 'Jazz', city: 'Utah', primary: '#F9A01B', secondary: '#002B5C' },
  WAS: { nbaId: 1610612764, name: 'Wizards', city: 'Washington', primary: '#E31837', secondary: '#002B5C' },
};

const FALLBACK: TeamBrand = {
  abbr: '',
  nbaId: 0,
  name: '',
  city: '',
  fullName: '',
  primary: '#ea580c', // brand orange
  secondary: '#78716c',
};

/** Brand info for an abbreviation, or a neutral fallback. */
export function getTeam(abbr: string | null | undefined): TeamBrand {
  if (!abbr) return FALLBACK;
  const t = TEAMS[abbr];
  if (!t) return { ...FALLBACK, abbr };
  return { abbr, fullName: `${t.city} ${t.name}`.trim(), ...t };
}

export type HeadshotSize = 'sm' | 'lg';

/** Official NBA headshot URL for a PERSON_ID. Missing ids return a silhouette. */
export function playerHeadshotUrl(personId: number, size: HeadshotSize = 'sm'): string {
  const px = size === 'lg' ? '1040x760' : '260x190';
  return `https://cdn.nba.com/headshots/nba/latest/${px}/${personId}.png`;
}

/** Official NBA team logo (SVG) for a TEAM_ID. */
export function teamLogoUrl(teamNbaId: number): string {
  return `https://cdn.nba.com/logos/nba/${teamNbaId}/primary/L/logo.svg`;
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
