import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SportSelect } from '@/components/SportSelect';
import { FilterableLeaders } from '@/components/FilterableLeaders';
import { FreshnessNote } from '@/components/FreshnessNote';
import { RelatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { getLeaders, getDataFreshness } from '@/lib/server/players';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { breadcrumbList, datasetNode, graph } from '@/lib/jsonLd';
import { currentSeason } from '@/lib/season';
import { num1 } from '@/lib/format';
import { STAT_DEFS, type StatKey } from '@/lib/stats';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { LeaderRow } from '@/lib/types';

export const revalidate = 3600;
export const dynamicParams = false;

// Leaders-eligible stats per sport (those with a clean per-game aggregate).
const LEADER_STATS: Record<Sport, StatKey[]> = {
  nba: ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk', 'pra'],
  mlb: ['hits', 'tb', 'hr', 'rbi', 'runs', 'sb', 'bb', 'so'],
  nfl: ['passYds', 'passTds', 'rushYds', 'rushTds', 'rec', 'recYds', 'recTds'],
};

export function generateStaticParams() {
  return SPORT_LIST.flatMap((sport) =>
    LEADER_STATS[sport].map((stat) => ({ sport, stat })),
  );
}

type PageProps = { params: Promise<{ sport: string; stat: string }> };

function isLeaderStat(sport: Sport, stat: string): stat is StatKey {
  return (LEADER_STATS[sport] as string[]).includes(stat);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport, stat } = await params;
  if (!isSport(sport) || !isLeaderStat(sport, stat)) return { title: 'Not found' };
  const cfg = SPORTS[sport];
  const label = STAT_DEFS[stat].label;
  const season = currentSeason(sport);
  const title = `${cfg.name} ${label} Leaders ${season} — Per Game`;
  const description = `${cfg.name} season per-game leaders in ${label.toLowerCase()} (${season}), computed from public box scores — research, not picks.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/leaders/${stat}` },
    openGraph: { type: 'website', title, description, url: `/${sport}/leaders/${stat}` },
  };
}

export default async function LeadersPage({ params }: PageProps) {
  const { sport: raw, stat: rawStat } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  if (!isLeaderStat(sport, rawStat)) notFound();
  const stat: StatKey = rawStat;
  const cfg = SPORTS[sport];
  const label = STAT_DEFS[stat].label;
  const short = STAT_DEFS[stat].short;
  const season = currentSeason(sport);
  const defaultStat = sport === 'mlb' ? 'hits' : sport === 'nfl' ? 'passYds' : 'pts';

  let rows: LeaderRow[] = [];
  let freshness: string | null = null;
  try {
    [rows, freshness] = await Promise.all([
      getLeaders(sport, stat, 100),
      getDataFreshness(sport),
    ]);
  } catch {
    // DB unavailable — render the empty state.
  }

  const top = rows[0];
  const jsonLd = graph([
    breadcrumbList([
      { name: 'Home', path: '/' },
      { name: cfg.name, path: `/${sport}` },
      { name: 'Leaders', path: `/${sport}/leaders/${defaultStat}` },
      { name: label, path: `/${sport}/leaders/${stat}` },
    ]),
    datasetNode({
      name: `${cfg.name} ${label} leaders ${season}`,
      description: `Per-game ${label.toLowerCase()} leaders, ${cfg.name} ${season}, from public game logs.`,
      path: `/${sport}/leaders/${stat}`,
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
          { label: 'Leaders', href: `/${sport}/leaders/${defaultStat}` },
          { label },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {cfg.name} {label} Leaders
        </h1>
        <SportSelect section="leaders" value={sport} />
      </div>
      {top ? (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          <span className="text-foreground">{top.player.fullName}</span> leads the{' '}
          {cfg.name} in {label.toLowerCase()} at{' '}
          <span className="text-foreground">
            {num1(top.perGame)} {short}
          </span>{' '}
          per game this season ({season}). Per-game averages from public box scores.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Season per-game {label.toLowerCase()} leaders, {cfg.name} {season}.
        </p>
      )}
      <FreshnessNote date={freshness} className="mt-2" />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {LEADER_STATS[sport].map((s) => (
          <Link
            key={s}
            href={`/${sport}/leaders/${s}`}
            aria-current={s === stat ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              s === stat
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-line text-muted hover:text-foreground'
            }`}
          >
            {STAT_DEFS[s].short}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No leaders to show yet — check back after the next nightly update.
        </p>
      ) : (
        <div className="mt-5">
          <FilterableLeaders sport={sport} rows={rows} unit={short} />
        </div>
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'leaders')} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — season averages, not predictions,
        picks, or betting advice.
      </p>
    </div>
  );
}
