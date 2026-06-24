import type { PlayerBio } from '@/lib/types';
import type { Sport } from '@/lib/sports';

/** Compact bio strip (draft, college, country, experience). Data-agnostic. */
export function PlayerBioBar({
  bio,
  experience,
  sport,
}: {
  bio: PlayerBio;
  experience: number | null;
  sport: Sport;
}) {
  const items: { label: string; value: string }[] = [];

  // Only assert draft status for NBA (we ingest draft data there); for MLB we
  // simply omit it rather than mislabel everyone "Undrafted".
  if (sport === 'nba' || bio.draftYear) {
    items.push({
      label: 'Draft',
      value: bio.draftYear
        ? `${bio.draftYear}${
            bio.draftRound && bio.draftNumber
              ? ` · Rd ${bio.draftRound}, Pick ${bio.draftNumber}`
              : ''
          }`
        : 'Undrafted',
    });
  }
  if (bio.college && bio.college !== 'None') {
    items.push({ label: 'College', value: bio.college });
  }
  if (bio.country) items.push({ label: 'Country', value: bio.country });
  if (experience != null) {
    items.push({
      label: 'Experience',
      value: experience <= 1 ? 'Rookie' : `${experience} seasons`,
    });
  }

  if (items.length === 0) return null;

  return (
    <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 text-sm sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-xs uppercase tracking-wide text-muted">{it.label}</dt>
          <dd className="mt-0.5 font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
