import type { DvpTableRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { num1 } from '@/lib/format';
import { gradeTextClass } from '@/lib/tierStyle';
import { TeamLogo } from './TeamLogo';

/** A full team ranking of how much of a stat each team allows (rank 1 = most). */
export function DvpTable({ sport, rows, unit }: { sport: Sport; rows: DvpTableRow[]; unit: string }) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => (
        <li key={r.teamAbbreviation} className="flex items-center gap-3 px-3 py-2.5">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{r.rank}</span>
          <TeamLogo sport={sport} externalId={r.teamExternalId} abbr={r.teamAbbreviation} size={22} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{r.teamName}</div>
            <div className="text-xs text-muted">
              {r.lowSample ? 'low sample' : `${r.sampleSize} games`}
            </div>
          </div>
          <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
            {num1(r.avgAllowed)} <span className="text-xs font-normal text-muted">{unit}</span>
          </div>
          <span
            title="Matchup grade — A is the softest, F the toughest"
            className={`w-7 shrink-0 text-right text-sm font-bold ${gradeTextClass(r.grade)}`}
          >
            {r.grade}
          </span>
        </li>
      ))}
    </ol>
  );
}
