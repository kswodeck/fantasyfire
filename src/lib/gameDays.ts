// Day grouping for a slate that spans more than one day.
//
// Daily sports play their slate on one date, so a matchup chip only ever needed a
// start time. NFL (and MLS / college football) frame the slate as the WEEK — see
// slateWindowDays — so the same chips listed Thursday, Friday, Sunday and Monday
// games as one undifferentiated run of times under a single date, and there was no
// way to tell which three were today. Pure and timezone-explicit so it unit-tests
// without a browser.
import { formatIsoDate } from './format';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The calendar date (YYYY-MM-DD) an instant falls on in `timeZone` — the viewer's own
 * zone when omitted. Null for an unparseable timestamp.
 */
export function localDayIso(iso: string, timeZone?: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Calendar arithmetic on a YYYY-MM-DD date, done in UTC so no zone can shift it. */
export function addDaysIso(dayIso: string, days: number): string {
  const [y, m, d] = dayIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Group games by day, days in calendar order, each day keeping the games' incoming
 * order (the slate query already sorts by start time).
 */
export function groupGamesByDay<G>(
  games: readonly G[],
  dayOf: (g: G) => string,
): { day: string; games: G[] }[] {
  const byDay = new Map<string, G[]>();
  for (const g of games) {
    const day = dayOf(g);
    const list = byDay.get(day);
    if (list) list.push(g);
    else byDay.set(day, [g]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, list]) => ({ day, games: list }));
}

/**
 * A day's heading: "Thu, Nov 26", prefixed "Today" / "Tomorrow" when `todayIso` is
 * known. `todayIso` is null until the browser has hydrated — the server cannot know
 * the viewer's date — so the relative word only appears once it can be right.
 */
export function formatDayLabel(dayIso: string, todayIso: string | null): string {
  const [y, m, d] = dayIso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const date = `${weekday}, ${MONTHS[m - 1]} ${d}`;
  if (todayIso === dayIso) return `Today · ${date}`;
  if (todayIso && addDaysIso(todayIso, 1) === dayIso) return `Tomorrow · ${date}`;
  return date;
}

/**
 * The span a slate covers: "Nov 26, 2026" for one day, "Nov 26–30, 2026" within a
 * month, "Nov 29 – Dec 2, 2026" across months, and both years when it crosses one.
 */
export function formatDayRange(firstIso: string, lastIso: string): string {
  if (firstIso === lastIso) return formatIsoDate(firstIso);
  const [y1, m1, d1] = firstIso.split('-').map(Number);
  const [y2, m2, d2] = lastIso.split('-').map(Number);
  if (y1 !== y2) return `${formatIsoDate(firstIso)} – ${formatIsoDate(lastIso)}`;
  if (m1 !== m2) return `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}, ${y2}`;
  return `${MONTHS[m1 - 1]} ${d1}–${d2}, ${y2}`;
}

/**
 * The games a day heading selects: the ones that have NOT started. A started game's
 * props are dead, which is why the picker already leaves it out of the default scope
 * — selecting a whole day must not quietly put it back. If every game that day has
 * started there is nothing upcoming to pick, so it takes them all; the tap should
 * never do nothing.
 */
export function dayTargetIds(
  dayGames: readonly { externalId: string }[],
  startedIds: ReadonlySet<string>,
): string[] {
  const all = dayGames.map((g) => g.externalId);
  const upcoming = all.filter((id) => !startedIds.has(id));
  return upcoming.length > 0 ? upcoming : all;
}

/**
 * Toggle a set of ids as one: add them all, unless every one is already selected, in
 * which case take them all back out. Other selections are left alone, so a day adds
 * to whatever else is picked rather than replacing it.
 */
export function toggleIds(
  prev: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const next = new Set(prev);
  const allIn = ids.length > 0 && ids.every((id) => next.has(id));
  for (const id of ids) {
    if (allIn) next.delete(id);
    else next.add(id);
  }
  return next;
}
