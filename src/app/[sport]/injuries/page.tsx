import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks } from '@/components/RelatedLinks';
import { InjuriesClient } from '@/components/InjuriesClient';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { getInjuryReport } from '@/lib/server/players';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { InjuryReportRow } from '@/lib/types';

export const revalidate = 1800; // 30 min — injuries change intraday
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_LIST.map((sport) => ({ sport }));
}

type PageProps = { params: Promise<{ sport: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const cfg = SPORTS[sport];
  return {
    title: `${cfg.name} Injury Report — Out, Questionable & Day-to-Day`,
    description: `Today's ${cfg.name} injury report: who's Out, Questionable, GTD, or on the IL, with the injury and estimated return — the availability context behind every prop read.`,
    alternates: { canonical: `/${sport}/injuries` },
  };
}

export default async function InjuriesPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  let rows: InjuryReportRow[] = [];
  try {
    rows = await getInjuryReport(sport);
  } catch {
    // DB unavailable — render the empty state.
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Injuries' },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Injury Report</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Current availability from public injury feeds — who&rsquo;s Out, on the IL, or a
        game-time decision, with the injury and estimated return. Availability is the
        context behind every read: confirm a player is active before you act on a prop.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No injuries reported right now. Check back closer to game time.
        </p>
      ) : (
        <InjuriesClient sport={sport} rows={rows} />
      )}

      <RelatedLinks links={sportMeshLinks(sport)} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Availability from public feeds, refreshed through the day — confirm a
        player&rsquo;s status with the official report before wagering. Not predictions,
        picks, or betting advice.
      </p>
    </div>
  );
}
