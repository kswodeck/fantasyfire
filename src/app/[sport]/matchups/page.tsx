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

const NBA_STATS: StatKey[] = ['pts', 'reb', 'ast', 'fg3m', 'pra'];
const MLB_STATS: StatKey[] = ['hits', 'tb', 'hr', 'rbi', 'runs'];
const NBA_POS: { value: PosBucket; label: string }[] = [
  { value: 'G', label: 'Guards' },
  { value: 'F', label: 'Forwards' },
  { value: 'C', label: 'Centers' },
];
const MLB_POS: { value: PosBucket; label: string }[] = [{ value: 'H', label: 'Hitters' }];
const NFL_POS: { value: PosBucket; label: string }[] = [
  { value: 'QB', label: 'Quarterbacks' },
  { value: 'RB', label: 'Running Backs' },
  { value: 'WR', label: 'Wide Receivers' },
  { value: 'TE', label: 'Tight Ends' },
];
// NFL stats are position-specific, so each position offers only its real markets.
const NFL_STATS_BY_POS: Record<string, StatKey[]> = {
  QB: ['passYds', 'passTds', 'passCmp', 'rushYds'],
  RB: ['rushYds', 'carries', 'rushTds', 'rec', 'recYds'],
  WR: ['recYds', 'rec', 'recTds', 'targets'],
  TE: ['recYds', 'rec', 'recTds', 'targets'],
};
const NFL_STATS: StatKey[] = [
  'passYds',
  'passTds',
  'passCmp',
  'rushYds',
  'carries',
  'rushTds',
  'rec',
  'recYds',
  'recTds',
  'targets',
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const title =
    sport === 'mlb'
      ? 'MLB Pitching Allowed — Stats Given Up by Team'
      : sport === 'nfl'
        ? 'NFL Defense vs Position — Stats Allowed by Team'
        : 'NBA Defense vs Position — Stats Allowed by Team';
  const description =
    sport === 'mlb'
      ? "Which MLB teams' pitching gives up the most hits, total bases, home runs, RBIs and runs per game — ranked softest to toughest, from public box scores."
      : sport === 'nfl'
        ? 'NFL defense vs position: which teams allow the most passing yards, rushing yards and receiving yards to QBs, RBs, WRs and TEs — ranked softest to toughest, from public game logs.'
        : 'NBA defense vs position: which teams allow the most points, rebounds, assists and threes to guards, forwards and centers — ranked softest to toughest, from public box scores.';
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
  const stats = sport === 'nba' ? NBA_STATS : sport === 'nfl' ? NFL_STATS : MLB_STATS;
  const positions = sport === 'nba' ? NBA_POS : sport === 'nfl' ? NFL_POS : MLB_POS;
  const statsByPosition = sport === 'nfl' ? NFL_STATS_BY_POS : undefined;
  const heading =
    sport === 'mlb'
      ? 'MLB Pitching Allowed'
      : sport === 'nfl'
        ? 'NFL Defense vs Position'
        : 'NBA Defense vs Position';

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
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
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
