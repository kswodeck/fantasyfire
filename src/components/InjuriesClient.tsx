'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Sport } from '@/lib/sports';
import type { InjuryReportRow } from '@/lib/types';
import { formatIsoDate } from '@/lib/format';
import {
  classifyDesignation,
  DESIGNATION_ORDER,
  DESIGNATIONS,
  type DesignationKey,
} from '@/lib/injury';
import { InjuryBadge } from './InjuryBadge';
import { MultiSelect, type MultiSelectOption } from './MultiSelect';
import { normalizeName } from '@/lib/slate';

const STATUS_LABEL: Record<InjuryReportRow['status'], string> = {
  out: 'Out',
  doubtful: 'Doubtful',
  questionable: 'Questionable',
  'day-to-day': 'Day-to-day',
};
const STATUS_ORDER: InjuryReportRow['status'][] = [
  'out',
  'doubtful',
  'questionable',
  'day-to-day',
];
const statusClass = (s: InjuryReportRow['status']) =>
  s === 'out' ? 'text-under' : s === 'day-to-day' ? 'text-muted' : 'text-heat-2';

/**
 * Injury report list with a player-name search and a multi-select designation filter
 * (Out / IL / GTD / Q …). No selection = show every designation. Rows stay grouped by
 * the coarse status bucket for scannability; the filters narrow within it.
 * Server-rendered for SEO on first paint, interactive after hydration.
 */
export function InjuriesClient({
  sport,
  rows,
}: {
  sport: Sport;
  rows: InjuryReportRow[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  // Tag every row with its fine designation once.
  const tagged = useMemo(
    () => rows.map((r) => ({ row: r, key: classifyDesignation(r) })),
    [rows],
  );

  // Only offer designations that actually appear, in canonical severity order, with counts.
  const options = useMemo<MultiSelectOption[]>(() => {
    const counts = new Map<DesignationKey, number>();
    for (const { key } of tagged) counts.set(key, (counts.get(key) ?? 0) + 1);
    return DESIGNATION_ORDER.filter((k) => counts.has(k)).map((k) => ({
      value: k,
      label: DESIGNATIONS[k].label,
      count: counts.get(k),
    }));
  }, [tagged]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const nq = normalizeName(query);
  const filtered = useMemo(() => {
    const byDesignation =
      selectedSet.size === 0 ? tagged : tagged.filter((t) => selectedSet.has(t.key));
    return nq === ''
      ? byDesignation
      : byDesignation.filter((t) => normalizeName(t.row.name).includes(nq));
  }, [tagged, selectedSet, nq]);

  const byStatus = STATUS_ORDER.map((s) => ({
    status: s,
    rows: filtered.filter((t) => t.row.status === s).map((t) => t.row),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search players by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="w-44 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <MultiSelect
          label="Filter by injury designation"
          allLabel="All designations"
          options={options}
          selected={selected}
          onChange={setSelected}
        />
        <span className="ml-auto text-xs tabular-nums text-muted">
          {filtered.length === rows.length
            ? `${rows.length} players`
            : `${filtered.length} of ${rows.length} players`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No players match{nq !== '' ? ' this search' : ''}
          {nq !== '' && selectedSet.size > 0 ? ' and' : ''}
          {selectedSet.size > 0 ? ' the selected designations' : ''}.
        </p>
      ) : (
        <div className="space-y-6">
          {byStatus.map((group) => (
            <section key={group.status}>
              <h2
                className={`mb-2 flex items-center gap-2 text-sm font-semibold ${statusClass(group.status)}`}
              >
                {STATUS_LABEL[group.status]}
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  {group.rows.length}
                </span>
              </h2>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {group.rows.map((r) => (
                  <li
                    key={r.slug}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-3 text-sm"
                  >
                    <Link
                      href={`/${sport}/${r.slug}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {r.name}
                    </Link>
                    <InjuryBadge injury={r} className="self-center" />
                    <span className="text-xs text-muted">
                      {[r.team, r.position].filter(Boolean).join(' · ')}
                    </span>
                    {r.detail && <span className="text-xs text-muted">{r.detail}</span>}
                    {r.status === 'out' && r.returnDate && (
                      <span className="text-xs text-muted">
                        · est. return {formatIsoDate(r.returnDate)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
