import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks } from '@/components/RelatedLinks';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { getInjuryReport } from '@/lib/server/players';
import { formatIsoDate } from '@/lib/format';
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

const STATUS_LABEL: Record<InjuryReportRow['status'], string> = {
  out: 'Out',
  doubtful: 'Doubtful',
  questionable: 'Questionable',
  'day-to-day': 'Day-to-day',
};
const STATUS_ORDER: InjuryReportRow['status'][] = ['out', 'doubtful', 'questionable', 'day-to-day'];
const statusClass = (s: InjuryReportRow['status']) =>
  s === 'out' ? 'text-under' : s === 'day-to-day' ? 'text-muted' : 'text-heat-2';

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
  const byStatus = STATUS_ORDER.map((s) => ({ status: s, rows: rows.filter((r) => r.status === s) })).filter(
    (g) => g.rows.length > 0,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: cfg.name, href: `/${sport}` }, { label: 'Injuries' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Injury Report</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Current availability from public injury feeds — who&rsquo;s Out, on the IL, or a game-time
        decision, with the injury and estimated return. Availability is the context behind every
        read: confirm a player is active before you act on a prop.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No injuries reported right now. Check back closer to game time.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {byStatus.map((group) => (
            <section key={group.status}>
              <h2 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${statusClass(group.status)}`}>
                {STATUS_LABEL[group.status]}
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  {group.rows.length}
                </span>
              </h2>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {group.rows.map((r) => (
                  <li key={r.slug} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-3 text-sm">
                    <Link href={`/${sport}/${r.slug}`} className="font-medium text-brand hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-muted">
                      {[r.team, r.position].filter(Boolean).join(' · ')}
                    </span>
                    {r.fantasyStatus && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {r.fantasyStatus}
                      </span>
                    )}
                    {r.detail && <span className="text-xs text-muted">{r.detail}</span>}
                    {r.status === 'out' && r.returnDate && (
                      <span className="text-xs text-muted">· est. return {formatIsoDate(r.returnDate)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <RelatedLinks links={sportMeshLinks(sport)} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Availability from public feeds, refreshed through the day — confirm a player&rsquo;s status
        with the official report before wagering. Not predictions, picks, or betting advice.
      </p>
    </div>
  );
}
