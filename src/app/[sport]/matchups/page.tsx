import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SportSelect } from '@/components/SportSelect';
import { DvpExplorer } from '@/components/DvpExplorer';
import { FreshnessNote } from '@/components/FreshnessNote';
import { RelatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { getDvpTable, getDataFreshness } from '@/lib/server/players';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { breadcrumbList, datasetNode, graph } from '@/lib/jsonLd';
import { STAT_DEFS, type StatKey, type PosBucket } from '@/lib/stats';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { DvpTableRow } from '@/lib/types';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_LIST.map((sport) => ({ sport }));
}

type PageProps = { params: Promise<{ sport: string }> };

// Per-sport matchup-table config: which stats × positions have a meaningful
// "allowed by team" read, plus the SEO copy. `statsByPosition` (when set) scopes
// each position to its real markets instead of the full cartesian.
interface MatchupsConfig {
  stats: StatKey[];
  positions: { value: PosBucket; label: string }[];
  statsByPosition?: Record<string, StatKey[]>;
  heading: string;
  title: string;
  description: string;
}

const BASKETBALL_MATCHUPS = (league: 'NBA' | 'WNBA'): MatchupsConfig => ({
  stats: ['pts', 'reb', 'ast', 'fg3m', 'pra'],
  positions: [
    { value: 'G', label: 'Guards' },
    { value: 'F', label: 'Forwards' },
    { value: 'C', label: 'Centers' },
  ],
  heading: `${league} Defense vs Position`,
  title: `${league} Defense vs Position — Stats Allowed by Team`,
  description: `${league} defense vs position: which teams allow the most points, rebounds, assists and threes to guards, forwards and centers — ranked softest to toughest, from public box scores.`,
});

const SOCCER_MATCHUPS = (league: 'MLS'): MatchupsConfig => ({
  stats: ['shots', 'sot', 'goals', 'saves', 'ga'],
  positions: [
    { value: 'F', label: 'Forwards' },
    { value: 'M', label: 'Midfielders' },
    { value: 'D', label: 'Defenders' },
    { value: 'G', label: 'Goalkeepers' },
  ],
  statsByPosition: {
    F: ['shots', 'sot', 'goals'],
    M: ['shots', 'sot', 'goals'],
    D: ['shots', 'sot', 'goals'],
    G: ['saves', 'ga'],
  },
  heading: `${league} Defense vs Position`,
  title: `${league} Defense vs Position — Stats Allowed by Team`,
  description: `${league} defense vs position: which teams concede the most shots, shots on target and goals to forwards, midfielders and defenders — ranked softest to toughest, from public match stats.`,
});

const MATCHUPS: Record<Sport, MatchupsConfig> = {
  nba: BASKETBALL_MATCHUPS('NBA'),
  wnba: BASKETBALL_MATCHUPS('WNBA'),
  mlb: {
    stats: ['hits', 'tb', 'hr', 'rbi', 'runs'],
    positions: [{ value: 'H', label: 'Hitters' }],
    heading: 'MLB Pitching Allowed',
    title: 'MLB Pitching Allowed — Stats Given Up by Team',
    description:
      "Which MLB teams' pitching gives up the most hits, total bases, home runs, RBIs and runs per game — ranked softest to toughest, from public box scores.",
  },
  nfl: {
    stats: ['passYds', 'passTds', 'passCmp', 'rushYds', 'carries', 'rushTds', 'rec', 'recYds', 'recTds', 'targets'],
    positions: [
      { value: 'QB', label: 'Quarterbacks' },
      { value: 'RB', label: 'Running Backs' },
      { value: 'WR', label: 'Wide Receivers' },
      { value: 'TE', label: 'Tight Ends' },
    ],
    // NFL stats are position-specific, so each position offers only its real markets.
    statsByPosition: {
      QB: ['passYds', 'passTds', 'passCmp', 'rushYds'],
      RB: ['rushYds', 'carries', 'rushTds', 'rec', 'recYds'],
      WR: ['recYds', 'rec', 'recTds', 'targets'],
      TE: ['recYds', 'rec', 'recTds', 'targets'],
    },
    heading: 'NFL Defense vs Position',
    title: 'NFL Defense vs Position — Stats Allowed by Team',
    description:
      'NFL defense vs position: which teams allow the most passing yards, rushing yards and receiving yards to QBs, RBs, WRs and TEs — ranked softest to toughest, from public game logs.',
  },
  nhl: {
    stats: ['sog', 'pts', 'goals', 'nhlHits', 'blocked', 'saves', 'ga'],
    positions: [
      { value: 'F', label: 'Forwards' },
      { value: 'D', label: 'Defensemen' },
      { value: 'G', label: 'Goalies' },
    ],
    statsByPosition: {
      F: ['sog', 'pts', 'goals', 'nhlHits'],
      D: ['sog', 'pts', 'blocked', 'nhlHits'],
      G: ['saves', 'ga'],
    },
    heading: 'NHL Defense vs Position',
    title: 'NHL Defense vs Position — Stats Allowed by Team',
    description:
      'NHL defense vs position: which teams give up the most shots on goal, points and goals to forwards and defensemen (and force the most goalie saves) — ranked softest to toughest, from public box scores.',
  },
  mls: SOCCER_MATCHUPS('MLS'),
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const { title, description } = MATCHUPS[sport];
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/matchups` },
    openGraph: { type: 'website', title, description, url: `/${sport}/matchups` },
  };
}

export default async function MatchupsPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];
  const { stats, positions, statsByPosition, heading } = MATCHUPS[sport];

  const tables: Record<string, DvpTableRow[]> = {};
  let freshness: string | null = null;
  try {
    // Only load the meaningful (stat, position) combos — for NFL that's each
    // position's own markets; for NBA/MLB it's the full cartesian.
    const combos = statsByPosition
      ? positions.flatMap((p) =>
          (statsByPosition[p.value] ?? []).map((stat) => ({ stat, pos: p.value })),
        )
      : stats.flatMap((stat) => positions.map((p) => ({ stat, pos: p.value })));
    const entries = await Promise.all(
      combos.map(
        async ({ stat, pos }) =>
          [`${stat}:${pos}`, await getDvpTable(sport, stat, pos)] as const,
      ),
    );
    for (const [k, v] of entries) tables[k] = v;
    freshness = await getDataFreshness(sport);
  } catch {
    // DB unavailable — render the empty state.
  }

  const statOpts = stats.map((s) => ({ value: s as string, label: STAT_DEFS[s].label }));
  const unitByStat = Object.fromEntries(
    stats.map((s) => [s as string, STAT_DEFS[s].short]),
  );
  const hasData = Object.values(tables).some((t) => t.length > 0);

  const jsonLd = graph([
    breadcrumbList([
      { name: 'Home', path: '/' },
      { name: cfg.name, path: `/${sport}` },
      { name: 'Matchups', path: `/${sport}/matchups` },
    ]),
    datasetNode({
      name: `${heading} — ${cfg.name} stats allowed by team`,
      description: `How much of each stat every ${cfg.name} team allows, ranked, computed from public game logs.`,
      path: `/${sport}/matchups`,
      dateModified: freshness,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Matchups' },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
        <SportSelect section="matchups" value={sport} />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        {sport === 'mlb'
          ? 'How many of each stat every team’s pitching staff allows to hitters per game, ranked from the softest matchup (rank 1, allows the most) to the toughest — a quick read on which opponents inflate or suppress a prop.'
          : 'How much of each stat every team allows to a given position per game, ranked from the softest matchup (rank 1, allows the most) to the toughest — a quick read on which opponents inflate or suppress a prop.'}
      </p>
      <FreshnessNote date={freshness} className="mt-2" />

      <div className="mt-5">
        {hasData ? (
          <DvpExplorer
            sport={sport}
            tables={tables}
            stats={statOpts}
            positions={positions}
            unitByStat={unitByStat}
            statsByPosition={statsByPosition}
          />
        ) : (
          <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
            No matchup data yet — check back after the next nightly update.
          </p>
        )}
      </div>

      <RelatedLinks links={sportMeshLinks(sport, 'matchups')} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — team-allowed averages describe past
        games and are not predictions, picks, or betting advice.
      </p>
    </div>
  );
}
