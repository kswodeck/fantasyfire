import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getCalibration } from '@/lib/server/players';
import { pct, formatIsoDate } from '@/lib/format';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { Calibration } from '@/lib/types';
import { calibrationVerdict } from '@/lib/calibrationVerdict';
import { CalibrationStatusBadge } from '@/components/CalibrationStatusBadge';
import { RelatedLinks } from '@/components/RelatedLinks';
import { sportMeshLinks } from '@/lib/relatedLinks';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_LIST.map((sport) => ({ sport }));
}

type PageProps = { params: Promise<{ sport: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const cfg = SPORTS[sport];
  const title = `${cfg.name} Accuracy — How Our FireScore Leans Hold Up`;
  const description = `An honest, descriptive backtest: when FantasyFire's FireScore leaned a side on a ${cfg.name} prop, how often did the player's next game land on it? Calibrated by confidence, not a pick record.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/accuracy` },
    openGraph: { type: 'website', title, description, url: `/${sport}/accuracy` },
  };
}

export default async function AccuracyPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  let cal: Calibration = { totalGraded: 0, overallWinRate: null, trackingSince: null, buckets: [] };
  try {
    cal = await getCalibration(sport);
  } catch {
    // DB unavailable — render the empty state.
  }
  const verdict = calibrationVerdict(cal);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Accuracy' },
        ]}
      />
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Accuracy</h1>
        <CalibrationStatusBadge status={verdict.status} />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        When our <strong className="text-foreground">FireScore</strong>{' '}leaned a side on a prop,
        how often did the player&rsquo;s <strong className="text-foreground">next game</strong>{' '}
        actually land on it? This is a <strong className="text-foreground">descriptive backtest of past
        performance</strong> — not a pick record, not a guarantee. If the signal has value, the
        stronger tiers should win more often than the weaker ones.
      </p>
      {cal.totalGraded > 0 && (
        <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <strong className="text-foreground">Verdict:</strong>{' '}
          <span className="text-muted">{verdict.headline}</span>
        </p>
      )}

      {cal.totalGraded === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          We&rsquo;re just starting to track this — check back as graded results accumulate.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Graded leans" value={cal.totalGraded.toLocaleString()} />
            <Stat
              label="Side won"
              value={cal.overallWinRate === null ? '—' : pct(cal.overallWinRate)}
            />
            <Stat
              label="Tracking since"
              value={cal.trackingSince ? formatIsoDate(cal.trackingSince) : '—'}
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">Tier</th>
                  <th className="px-3 py-2 text-right font-semibold">Graded</th>
                  <th className="px-3 py-2 text-right font-semibold">Side won</th>
                  <th className="px-3 py-2 text-right font-semibold">95% CI</th>
                </tr>
              </thead>
              <tbody>
                {cal.buckets.map((b) => (
                  <tr key={b.label} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{b.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{b.decided}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {b.winRate === null ? '—' : pct(b.winRate)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {b.decided === 0 ? '—' : `${pct(b.lower)}–${pct(b.upper)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            &ldquo;Side won&rdquo; = the player&rsquo;s next game landed on the side we leaned (pushes
            excluded). Early buckets are small — read the confidence interval, not just the
            percentage. A coin flip is 50%. See <Link href="/methodology">methodology</Link> for how
            FireScore is computed.
          </p>
        </>
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'accuracy')} />

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — not predictions, picks, or betting advice.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
