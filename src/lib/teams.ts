// Team branding + official image URLs, per sport.
//
// REAL / deterministic images, keyed by the external id we already store:
//   NBA headshot: cdn.nba.com/headshots/nba/latest/{size}/{personId}.png
//   NBA logo:     cdn.nba.com/logos/nba/{teamId}/primary/L/logo.svg
//   MLB headshot: midfield.mlbstatic.com/v1/people/{personId}/spots/{px}
//   MLB logo:     www.mlbstatic.com/team-logos/{teamId}.svg
//   NFL headshot: a.espncdn.com/i/headshots/nfl/players/full/{athleteId}.png
//   NFL logo:     a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png (keyed by abbr)
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

// NFL colors seeded from ESPN's team feed, then tuned so `primary` reads as a
// tint on both themes (a few brands list white/black/navy as their primary —
// swapped to the recognizable accent). Keyed by ESPN's standard abbreviations.
const NFL_TEAMS: Record<string, Entry> = {
  ARI: { name: 'Cardinals', city: 'Arizona', primary: '#A40227', secondary: '#000000' },
  ATL: { name: 'Falcons', city: 'Atlanta', primary: '#A71930', secondary: '#000000' },
  BAL: { name: 'Ravens', city: 'Baltimore', primary: '#29126F', secondary: '#000000' },
  BUF: { name: 'Bills', city: 'Buffalo', primary: '#00338D', secondary: '#D50A0A' },
  CAR: { name: 'Panthers', city: 'Carolina', primary: '#0085CA', secondary: '#101820' },
  CHI: { name: 'Bears', city: 'Chicago', primary: '#E64100', secondary: '#0B162A' },
  CIN: { name: 'Bengals', city: 'Cincinnati', primary: '#FB4F14', secondary: '#000000' },
  CLE: { name: 'Browns', city: 'Cleveland', primary: '#FF3C00', secondary: '#311D00' },
  DAL: { name: 'Cowboys', city: 'Dallas', primary: '#002A5C', secondary: '#B0B7BC' },
  DEN: { name: 'Broncos', city: 'Denver', primary: '#FC4C02', secondary: '#0A2343' },
  DET: { name: 'Lions', city: 'Detroit', primary: '#0076B6', secondary: '#B0B7BC' },
  GB: { name: 'Packers', city: 'Green Bay', primary: '#FFB612', secondary: '#203731' },
  HOU: { name: 'Texans', city: 'Houston', primary: '#C41230', secondary: '#03202F' },
  IND: { name: 'Colts', city: 'Indianapolis', primary: '#003B75', secondary: '#A5ACAF' },
  JAX: { name: 'Jaguars', city: 'Jacksonville', primary: '#007487', secondary: '#D7A22A' },
  KC: { name: 'Chiefs', city: 'Kansas City', primary: '#E31837', secondary: '#FFB612' },
  LAC: { name: 'Chargers', city: 'Los Angeles', primary: '#0080C6', secondary: '#FFC20E' },
  LAR: { name: 'Rams', city: 'Los Angeles', primary: '#003594', secondary: '#FFD100' },
  LV: { name: 'Raiders', city: 'Las Vegas', primary: '#A5ACAF', secondary: '#000000' },
  MIA: { name: 'Dolphins', city: 'Miami', primary: '#008E97', secondary: '#FC4C02' },
  MIN: { name: 'Vikings', city: 'Minnesota', primary: '#4F2683', secondary: '#FFC62F' },
  NE: { name: 'Patriots', city: 'New England', primary: '#C60C30', secondary: '#002A5C' },
  NO: { name: 'Saints', city: 'New Orleans', primary: '#D3BC8D', secondary: '#101820' },
  NYG: { name: 'Giants', city: 'New York', primary: '#003C7F', secondary: '#C9243F' },
  NYJ: { name: 'Jets', city: 'New York', primary: '#115740', secondary: '#000000' },
  PHI: { name: 'Eagles', city: 'Philadelphia', primary: '#004C54', secondary: '#000000' },
  PIT: { name: 'Steelers', city: 'Pittsburgh', primary: '#FFB612', secondary: '#101820' },
  SEA: { name: 'Seahawks', city: 'Seattle', primary: '#69BE28', secondary: '#002A5C' },
  SF: { name: '49ers', city: 'San Francisco', primary: '#AA0000', secondary: '#B3995D' },
  TB: { name: 'Buccaneers', city: 'Tampa Bay', primary: '#D50A0A', secondary: '#3E3A35' },
  TEN: { name: 'Titans', city: 'Tennessee', primary: '#4495D2', secondary: '#0C2340' },
  WSH: { name: 'Commanders', city: 'Washington', primary: '#5A1414', secondary: '#FFB612' },
};

// NHL/WNBA/EPL/MLS colors seeded from ESPN's team feed (the same source their
// ingest uses), then tuned like the NFL table: brands whose feed color is
// white/near-black get their recognizable accent as `primary` so chips read on
// both themes. Keyed by ESPN's standard abbreviations.
const NHL_TEAMS: Record<string, Entry> = {
  ANA: { name: 'Ducks', city: 'Anaheim', primary: '#FC4C02', secondary: '#000000' },
  BOS: { name: 'Bruins', city: 'Boston', primary: '#FDB71A', secondary: '#231F20' },
  BUF: { name: 'Sabres', city: 'Buffalo', primary: '#00468B', secondary: '#FDB71A' },
  CAR: { name: 'Hurricanes', city: 'Carolina', primary: '#E30426', secondary: '#000000' },
  CBJ: { name: 'Blue Jackets', city: 'Columbus', primary: '#002D62', secondary: '#E31937' },
  CGY: { name: 'Flames', city: 'Calgary', primary: '#DD1A32', secondary: '#000000' },
  CHI: { name: 'Blackhawks', city: 'Chicago', primary: '#E31937', secondary: '#000000' },
  COL: { name: 'Avalanche', city: 'Colorado', primary: '#860038', secondary: '#005EA3' },
  DAL: { name: 'Stars', city: 'Dallas', primary: '#20864C', secondary: '#000000' },
  DET: { name: 'Red Wings', city: 'Detroit', primary: '#E30526', secondary: '#C4CED4' },
  EDM: { name: 'Oilers', city: 'Edmonton', primary: '#FF4C00', secondary: '#00205B' },
  FLA: { name: 'Panthers', city: 'Florida', primary: '#E51937', secondary: '#002D62' },
  LA: { name: 'Kings', city: 'Los Angeles', primary: '#A2AAAD', secondary: '#121212' },
  MIN: { name: 'Wild', city: 'Minnesota', primary: '#124734', secondary: '#AE122A' },
  MTL: { name: 'Canadiens', city: 'Montreal', primary: '#C41230', secondary: '#013A81' },
  NJ: { name: 'Devils', city: 'New Jersey', primary: '#E30B2B', secondary: '#000000' },
  NSH: { name: 'Predators', city: 'Nashville', primary: '#FDBA31', secondary: '#002D62' },
  NYI: { name: 'Islanders', city: 'New York', primary: '#00529B', secondary: '#F47D31' },
  NYR: { name: 'Rangers', city: 'New York', primary: '#0056AE', secondary: '#E51937' },
  OTT: { name: 'Senators', city: 'Ottawa', primary: '#DD1A32', secondary: '#B79257' },
  PHI: { name: 'Flyers', city: 'Philadelphia', primary: '#FE5823', secondary: '#000000' },
  PIT: { name: 'Penguins', city: 'Pittsburgh', primary: '#FDB71A', secondary: '#000000' },
  SEA: { name: 'Kraken', city: 'Seattle', primary: '#A3DCE4', secondary: '#000D33' },
  SJ: { name: 'Sharks', city: 'San Jose', primary: '#00788A', secondary: '#070707' },
  STL: { name: 'Blues', city: 'St. Louis', primary: '#0070B9', secondary: '#FDB71A' },
  TB: { name: 'Lightning', city: 'Tampa Bay', primary: '#0070C7', secondary: '#C4CED4' },
  TOR: { name: 'Maple Leafs', city: 'Toronto', primary: '#3B7BBF', secondary: '#C4CED4' },
  UTAH: { name: 'Mammoth', city: 'Utah', primary: '#6CACE4', secondary: '#000000' },
  VAN: { name: 'Canucks', city: 'Vancouver', primary: '#008752', secondary: '#003E7E' },
  VGK: { name: 'Golden Knights', city: 'Vegas', primary: '#B4975A', secondary: '#344043' },
  WPG: { name: 'Jets', city: 'Winnipeg', primary: '#C41230', secondary: '#002D62' },
  WSH: { name: 'Capitals', city: 'Washington', primary: '#D71830', secondary: '#0B1F41' },
};

const WNBA_TEAMS: Record<string, Entry> = {
  ATL: { name: 'Dream', city: 'Atlanta', primary: '#E31837', secondary: '#5091CC' },
  CHI: { name: 'Sky', city: 'Chicago', primary: '#5091CD', secondary: '#FFD520' },
  CON: { name: 'Sun', city: 'Connecticut', primary: '#F05023', secondary: '#0A2240' },
  DAL: { name: 'Wings', city: 'Dallas', primary: '#C4D600', secondary: '#002B5C' },
  GS: { name: 'Valkyries', city: 'Golden State', primary: '#B38FCF', secondary: '#000000' },
  IND: { name: 'Fever', city: 'Indiana', primary: '#E03A3E', secondary: '#002D62' },
  LA: { name: 'Sparks', city: 'Los Angeles', primary: '#FDB927', secondary: '#552583' },
  LV: { name: 'Aces', city: 'Las Vegas', primary: '#A7A8AA', secondary: '#000000' },
  MIN: { name: 'Lynx', city: 'Minnesota', primary: '#79BC43', secondary: '#266092' },
  NY: { name: 'Liberty', city: 'New York', primary: '#86CEBC', secondary: '#000000' },
  PHX: { name: 'Mercury', city: 'Phoenix', primary: '#FA4B0A', secondary: '#3C286E' },
  POR: { name: 'Fire', city: 'Portland', primary: '#CEE5EB', secondary: '#000000' },
  SEA: { name: 'Storm', city: 'Seattle', primary: '#FEE11A', secondary: '#2C5235' },
  TOR: { name: 'Tempo', city: 'Toronto', primary: '#7B9DD1', secondary: '#7B1B38' },
  WSH: { name: 'Mystics', city: 'Washington', primary: '#E03A3E', secondary: '#002B5C' },
};

// Soccer clubs have no city/nickname split — `name` is the club's short display
// name and `city` stays empty, so fullName renders as just the club name.
const EPL_TEAMS: Record<string, Entry> = {
  ARS: { name: 'Arsenal', city: '', primary: '#E20520', secondary: '#003399' },
  AVL: { name: 'Aston Villa', city: '', primary: '#93BEE5', secondary: '#660E36' },
  BHA: { name: 'Brighton', city: '', primary: '#0606FA', secondary: '#FFDD00' },
  BOU: { name: 'Bournemouth', city: '', primary: '#F42727', secondary: '#000000' },
  BRE: { name: 'Brentford', city: '', primary: '#F42727', secondary: '#F8CED9' },
  CHE: { name: 'Chelsea', city: '', primary: '#3A7BD3', secondary: '#144992' },
  COV: { name: 'Coventry', city: '', primary: '#87CCED', secondary: '#000000' },
  CRY: { name: 'Crystal Palace', city: '', primary: '#0202FB', secondary: '#C8102E' },
  EVE: { name: 'Everton', city: '', primary: '#4068DE', secondary: '#132257' },
  FUL: { name: 'Fulham', city: '', primary: '#D7D7D7', secondary: '#000000' },
  HUL: { name: 'Hull', city: '', primary: '#F28800', secondary: '#000000' },
  IPS: { name: 'Ipswich', city: '', primary: '#3A6BD8', secondary: '#CD1937' },
  LEE: { name: 'Leeds', city: '', primary: '#FFCD00', secondary: '#1D5CB4' },
  LIV: { name: 'Liverpool', city: '', primary: '#D11317', secondary: '#00B2A9' },
  MAN: { name: 'Man United', city: '', primary: '#DA020E', secondary: '#FBE122' },
  MNC: { name: 'Man City', city: '', primary: '#99C5EA', secondary: '#00285E' },
  NEW: { name: 'Newcastle', city: '', primary: '#D7D7D7', secondary: '#000000' },
  NFO: { name: 'Nottm Forest', city: '', primary: '#C8102E', secondary: '#132257' },
  SUN: { name: 'Sunderland', city: '', primary: '#EB172B', secondary: '#87CCED' },
  TOT: { name: 'Spurs', city: '', primary: '#D7D7D7', secondary: '#132257' },
};

const MLS_TEAMS: Record<string, Entry> = {
  ATL: { name: 'Atlanta United', city: '', primary: '#9D2235', secondary: '#AA9767' },
  ATX: { name: 'Austin', city: '', primary: '#00B140', secondary: '#000000' },
  CHI: { name: 'Chicago Fire', city: '', primary: '#7CCDEF', secondary: '#FF0000' },
  CIN: { name: 'FC Cincinnati', city: '', primary: '#FE5000', secondary: '#003087' },
  CLB: { name: 'Columbus Crew', city: '', primary: '#FEDD00', secondary: '#000000' },
  CLT: { name: 'Charlotte', city: '', primary: '#0085CA', secondary: '#000000' },
  COL: { name: 'Colorado Rapids', city: '', primary: '#8A2432', secondary: '#8AB7E9' },
  DAL: { name: 'FC Dallas', city: '', primary: '#C6093B', secondary: '#001F5B' },
  DC: { name: 'D.C. United', city: '', primary: '#D61018', secondary: '#000000' },
  HOU: { name: 'Houston Dynamo', city: '', primary: '#FF6B00', secondary: '#101820' },
  LA: { name: 'LA Galaxy', city: '', primary: '#7FA8D8', secondary: '#00235D' },
  LAFC: { name: 'LAFC', city: '', primary: '#C7A36F', secondary: '#000000' },
  MIA: { name: 'Inter Miami', city: '', primary: '#F7B5CD', secondary: '#231F20' },
  MIN: { name: 'Minnesota United', city: '', primary: '#9BCDE4', secondary: '#000000' },
  MTL: { name: 'CF Montréal', city: '', primary: '#4B7BC8', secondary: '#003DA6' },
  NE: { name: 'New England', city: '', primary: '#CE0E2D', secondary: '#022166' },
  NSH: { name: 'Nashville', city: '', primary: '#ECE83A', secondary: '#1F1646' },
  NYC: { name: 'NYCFC', city: '', primary: '#9FD2FF', secondary: '#000229' },
  ORL: { name: 'Orlando City', city: '', primary: '#60269E', secondary: '#F0D283' },
  PHI: { name: 'Philadelphia Union', city: '', primary: '#E0D0A6', secondary: '#051F31' },
  POR: { name: 'Portland Timbers', city: '', primary: '#C99700', secondary: '#2C5234' },
  RBNY: { name: 'Red Bull NY', city: '', primary: '#BA0C2F', secondary: '#FFC72C' },
  RSL: { name: 'Real Salt Lake', city: '', primary: '#A32035', secondary: '#DAA900' },
  SD: { name: 'San Diego FC', city: '', primary: '#F89E1A', secondary: '#697A7C' },
  SEA: { name: 'Seattle Sounders', city: '', primary: '#2DC84D', secondary: '#0033A0' },
  SJ: { name: 'San Jose Earthquakes', city: '', primary: '#4B8AD4', secondary: '#003DA6' },
  SKC: { name: 'Sporting KC', city: '', primary: '#A7C6ED', secondary: '#0A2240' },
  STL: { name: 'St. Louis City', city: '', primary: '#EC1458', secondary: '#001544' },
  TOR: { name: 'Toronto FC', city: '', primary: '#AA182C', secondary: '#A2A9AD' },
  VAN: { name: 'Vancouver Whitecaps', city: '', primary: '#9DC2E5', secondary: '#12284C' },
};

const TABLES: Record<Sport, Record<string, Entry>> = {
  nba: NBA_TEAMS,
  mlb: MLB_TEAMS,
  nfl: NFL_TEAMS,
  nhl: NHL_TEAMS,
  wnba: WNBA_TEAMS,
  epl: EPL_TEAMS,
  mls: MLS_TEAMS,
};

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

// ESPN's headshot/logo CDN league segment for the ESPN-ingested sports.
const ESPN_LEAGUE: Partial<Record<Sport, string>> = {
  nfl: 'nfl',
  nhl: 'nhl',
  wnba: 'wnba',
  epl: 'soccer',
  mls: 'soccer',
};

/** Official headshot URL for a player's external id. Missing ids return a silhouette. */
export function playerHeadshotUrl(sport: Sport, externalId: number, size: HeadshotSize = 'sm'): string {
  if (sport === 'mlb') {
    const px = size === 'lg' ? '240' : '120';
    return `https://midfield.mlbstatic.com/v1/people/${externalId}/spots/${px}`;
  }
  const league = ESPN_LEAGUE[sport];
  if (league) {
    // ESPN serves one full headshot per athlete id (used for both sizes).
    return `https://a.espncdn.com/i/headshots/${league}/players/full/${externalId}.png`;
  }
  const px = size === 'lg' ? '1040x760' : '260x190';
  return `https://cdn.nba.com/headshots/nba/latest/${px}/${externalId}.png`;
}

/** Official team logo for a team. ESPN sports key by abbreviation — except soccer,
 *  whose ESPN logos are keyed by the club's ESPN team id. */
export function teamLogoUrl(sport: Sport, externalId: number, abbr?: string | null): string {
  if (sport === 'mlb') {
    return `https://www.mlbstatic.com/team-logos/${externalId}.svg`;
  }
  if (sport === 'epl' || sport === 'mls') {
    return `https://a.espncdn.com/i/teamlogos/soccer/500/${externalId}.png`;
  }
  const league = ESPN_LEAGUE[sport];
  if (league) {
    return `https://a.espncdn.com/i/teamlogos/${league}/500/${(abbr ?? '').toLowerCase()}.png`;
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
