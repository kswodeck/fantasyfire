'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useFavorites } from '@/hooks/useFavorites';
import { useSavedProps } from '@/hooks/useSavedProps';
import { removeFavorite } from '@/lib/favorites';
import { removeSavedProp, type SavedProp } from '@/lib/savedProps';
import { useHitRate } from '@/hooks/useHitRate';
import { STAT_DEFS } from '@/lib/stats';
import { SPORTS, SPORT_LIST, type Sport } from '@/lib/sports';
import { pct } from '@/lib/format';
import { tierTextClass, heatLabel, leanTextClass } from '@/lib/tierStyle';
import { LeanArrow } from './LeanArrow';
import { SideArrow } from './SideArrow';
import { BookLogo } from './BookLogo';
import { PayoutBadge } from './PayoutBadge';
import { orderSources, sourceLabel } from '@/lib/providedSources';
import { lineMovement, movementLabel } from '@/lib/lineMovement';
import { normalizeName } from '@/lib/slate';
import { EntryCalculator } from './EntryCalculator';

/** One player as shown on the Playbook: favorited and/or carrying saved props. */
interface PlayerEntry {
  sport: Sport;
  slug: string;
  name: string;
  team: string | null;
  isFavorite: boolean;
  props: SavedProp[];
  /** Newest saved-prop time, for ordering active players first. */
  recency: number;
}

export function PlaybookClient() {
  const { favorites, hydrated: favHydrated } = useFavorites();
  const { props, hydrated: propsHydrated } = useSavedProps();
  const hydrated = favHydrated && propsHydrated;
  // Source filter ('all' or a specific book) — saved props are per-source.
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  // Player-name search over the saved list (accent/punctuation insensitive).
  const [nameQuery, setNameQuery] = useState('');

  // Books that have at least one saved prop, with counts — drives the filter.
  const sourcesPresent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of props) counts.set(p.source, (counts.get(p.source) ?? 0) + 1);
    return orderSources([...counts.keys()]).map((source) => ({
      source,
      count: counts.get(source) as number,
    }));
  }, [props]);

  const groups = useMemo(() => {
    const byPlayer = new Map<string, PlayerEntry>();
    const keyOf = (sport: Sport, slug: string) => `${sport}:${slug}`;
    const favSet = new Set(favorites.map((f) => keyOf(f.sport, f.slug)));
    const nq = normalizeName(nameQuery);
    const nameOk = (name: string) => nq === '' || normalizeName(name).includes(nq);
    const shown = props.filter(
      (p) => (sourceFilter === 'all' || p.source === sourceFilter) && nameOk(p.name),
    );

    // Whole-player favorites aren't tied to a book, so only list them unfiltered.
    if (sourceFilter === 'all') {
      for (const f of favorites) {
        if (!nameOk(f.name)) continue;
        byPlayer.set(keyOf(f.sport, f.slug), {
          sport: f.sport,
          slug: f.slug,
          name: f.name,
          team: f.team ?? null,
          isFavorite: true,
          props: [],
          recency: 0,
        });
      }
    }
    for (const p of shown) {
      const k = keyOf(p.sport, p.slug);
      const existing = byPlayer.get(k);
      if (existing) {
        existing.props.push(p);
        existing.recency = Math.max(existing.recency, p.savedAt);
        existing.name ||= p.name;
        existing.team ??= p.team ?? null;
      } else {
        byPlayer.set(k, {
          sport: p.sport,
          slug: p.slug,
          name: p.name,
          team: p.team ?? null,
          isFavorite: favSet.has(k),
          props: [p],
          recency: p.savedAt,
        });
      }
    }

    for (const e of byPlayer.values()) e.props.sort((a, b) => b.savedAt - a.savedAt);

    // Group by sport in the canonical order; only sports with entries appear.
    return SPORT_LIST.map((sport) => {
      const players = [...byPlayer.values()]
        .filter((e) => e.sport === sport)
        .sort((a, b) => b.recency - a.recency);
      return { sport, players };
    }).filter((g) => g.players.length > 0);
  }, [favorites, props, sourceFilter, nameQuery]);

  if (!hydrated) {
    return <p className="mt-6 text-sm text-muted">Loading your Playbook…</p>;
  }

  if (favorites.length === 0 && props.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
        <p>
          Your Playbook is empty. Open any player and tap{' '}
          <span className="font-medium text-foreground">☆ Save player</span> to pin them, or{' '}
          <span className="font-medium text-foreground">★ Over / Under</span> under the verdict to
          track a specific prop.
        </p>
        {/* One door: the All Sports Heat Check — every in-season league's reads,
            where saves actually start. */}
        <p className="mt-3">
          <Link href="/board" className="font-medium text-brand hover:text-brand-strong">
            Browse players on the Heat Check →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {sourcesPresent.length > 0 && (
          <>
            <span className="mr-1 text-xs font-medium text-muted">Book</span>
            <FilterChip active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>
              All ({props.length})
            </FilterChip>
            {sourcesPresent.map(({ source, count }) => (
              <FilterChip
                key={source}
                active={sourceFilter === source}
                onClick={() => setSourceFilter(source)}
              >
                <BookLogo source={source} size={14} />
                {sourceLabel(source)} ({count})
              </FilterChip>
            ))}
          </>
        )}
        <input
          type="search"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="Search player…"
          aria-label="Search saved players by name"
          className="ml-auto w-40 rounded-full border border-line bg-surface px-3 py-1 text-xs text-foreground outline-none focus:border-brand"
        />
      </div>

      {/* PrizePicks entry EV — renders itself only when there are enough eligible
          PrizePicks STANDARD legs saved (it returns null otherwise). Fed the full
          saved list (not the filtered view) so the book/name filters above don't
          silently shrink an entry. */}
      <EntryCalculator props={props} />

      {groups.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">
          No saved players match these filters.{' '}
          <button
            type="button"
            onClick={() => {
              setSourceFilter('all');
              setNameQuery('');
            }}
            className="font-medium text-brand hover:text-brand-strong"
          >
            Show all
          </button>
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(({ sport, players }) => (
            <section key={sport}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {SPORTS[sport].name}
              </h2>
              <ul className="space-y-3">
                {players.map((e) => (
                  <PlayerCard key={`${e.sport}:${e.slug}`} entry={e} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Saved on this device only (browser storage) — they don&rsquo;t sync across devices and
        clear if you clear site data. No account, no tracking.
      </p>
    </div>
  );
}

/** A source filter pill on My Playbook. */
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'border-brand bg-brand/10 text-brand'
          : 'border-line bg-surface text-muted hover:text-foreground')
      }
    >
      {children}
    </button>
  );
}

function PlayerCard({ entry }: { entry: PlayerEntry }) {
  const [open, setOpen] = useState(false);
  const { sport, slug, name, team, isFavorite, props } = entry;
  const hasProps = props.length > 0;

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* At-a-glance, clickable region — the whole header expands/collapses (when
          there are props to show). The player-name link inside navigates instead. */}
      <div
        className={`px-4 py-3${hasProps ? ' cursor-pointer select-none' : ''}`}
        role={hasProps ? 'button' : undefined}
        tabIndex={hasProps ? 0 : undefined}
        aria-expanded={hasProps ? open : undefined}
        onClick={hasProps ? () => setOpen((v) => !v) : undefined}
        onKeyDown={
          hasProps
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen((v) => !v);
                }
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3">
          <Link
            href={`/${sport}/${slug}`}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 font-medium hover:text-brand"
          >
            {name}
            {team ? <span className="ml-2 text-xs text-muted">{team}</span> : null}
          </Link>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            {isFavorite && (
              <span className="rounded-full border border-brand bg-brand/10 px-2 py-0.5 font-medium text-brand">
                ★ Player
              </span>
            )}
            {hasProps && (
              <span className="rounded-full border border-line px-2 py-0.5 font-medium text-muted">
                {props.length} {props.length === 1 ? 'prop' : 'props'}
              </span>
            )}
            {hasProps && (
              <span aria-hidden="true" className="text-[10px] text-muted">
                {open ? '▲' : '▼'}
              </span>
            )}
          </div>
        </div>

        {/* Collapsed preview: a few prop chips, so the at-a-glance is informative. */}
        {hasProps && !open && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {props.slice(0, 4).map((p) => (
              <span
                key={`${p.stat}:${p.line}:${p.side}:${p.source}`}
                className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted"
              >
                <span className="font-medium text-foreground">{STAT_DEFS[p.stat].short}</span>
                <span
                  className={`inline-flex items-center gap-0.5 tabular-nums ${
                    p.side === 'over' ? 'text-over' : 'text-under'
                  }`}
                >
                  <SideArrow side={p.side} size={10} />
                  {p.line}
                </span>
                <PayoutBadge oddsType={p.oddsType} multiplier={p.multiplier} showLabel={false} glyphSize={10} />
                <MovementFlag prop={p} />
              </span>
            ))}
            {props.length > 4 && (
              <span className="px-1 py-0.5 text-[11px] text-muted">+{props.length - 4} more</span>
            )}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-line">
          <ul>
            {props.map((p) => (
              <PropRow key={`${p.stat}:${p.line}:${p.side}:${p.source}`} prop={p} />
            ))}
          </ul>
        </div>
      )}

      {/* Player-level actions (always available) */}
      {(open || !hasProps) && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs">
          <Link href={`/${sport}/${slug}`} className="font-medium text-brand hover:text-brand-strong">
            Open {name}&rsquo;s page →
          </Link>
          {isFavorite && (
            <button
              type="button"
              onClick={() => removeFavorite(sport, slug)}
              className="text-muted transition-colors hover:text-under"
            >
              Remove player
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The line-move marker on a COLLAPSED prop chip.
 *
 * A move the reader has to expand a card to find isn't an alert, and cards are
 * collapsed by default — so this sits in the at-a-glance row. It costs no extra
 * network: the query key is identical to PropRow's (and to the entry calculator's
 * for eligible legs), so React Query serves all three from one cache entry, and
 * expanding the card fetches nothing new.
 */
function MovementFlag({ prop }: { prop: SavedProp }) {
  const { sport, slug, stat, line, source } = prop;
  const { data } = useHitRate({ sport, slug, stat, line, source });
  const moved = data ? lineMovement(prop, data.variants) : null;
  if (!moved) return null;
  return (
    <span
      className={`font-semibold tabular-nums ${
        moved.status === 'unlisted'
          ? 'text-muted'
          : moved.favorable
            ? 'text-sig-green'
            : 'text-sig-amber'
      }`}
      title={
        moved.status === 'unlisted'
          ? `${sourceLabel(source)} no longer posts this rung.`
          : `${sourceLabel(source)} moved this line to ${moved.currentLine} — ${
              moved.favorable ? 'in favor of' : 'against'
            } your ${prop.side}.`
      }
    >
      {moved.status === 'unlisted' ? '✕' : `→${moved.currentLine}`}
    </span>
  );
}

/**
 * A single saved prop with a live read fetched on demand (only while expanded).
 * Laid out like a Heat Check board row so the Playbook reads in the site's one
 * visual language: the whole row is a stretched link to the prop's full read
 * (no separate "View" link to float around); the left column says WHAT you
 * saved (prop + side/line + payout, then book + when), the right column is the
 * aligned read (heat word, FF + season rate, and whether the current lean is
 * still your side); the remove ✕ sits above the link at the far right.
 */
function PropRow({ prop }: { prop: SavedProp }) {
  const { sport, slug, stat, line, side, source, savedAt } = prop;
  const def = STAT_DEFS[stat];
  // Read vs the SAVED book, so line attribution (and the payout tag) match the save.
  const query = useHitRate({ sport, slug, stat, line, source });
  const research = query.data;

  const season = research?.windows.find((w) => w.window === 'season')?.hitRate;
  const overRate = season?.hitRateOver ?? null;
  const sideRate = overRate === null ? null : side === 'over' ? overRate : 1 - overRate;
  const fs = research?.verdict.fireScore;
  const fsIsLean = fs ? fs.tier !== 'No lean' && fs.tier !== 'Pass' : false;
  // Has the book re-priced this rung since the save? The research payload already
  // carries the source's live ladder, so this costs no extra request.
  const moved = research ? lineMovement(prop, research.variants) : null;

  return (
    <li className="relative flex items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-surface-2">
      <Link
        href={`/${sport}/${slug}/${stat}?line=${line}&source=${source}`}
        aria-label={`View ${def.label} ${side} ${line} (${sourceLabel(source)})`}
        className="absolute inset-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          <span>
            {def.label}{' '}
            <span className="tabular-nums">
              <span className={leanTextClass(side)}>{side === 'over' ? 'Over' : 'Under'}</span> {line}
            </span>
          </span>
          <PayoutBadge oddsType={prop.oddsType} multiplier={prop.multiplier} showLabel={false} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted">
          <BookLogo source={source} size={13} />
          <span>{sourceLabel(source)}</span>
          <span>· Saved {relativeTime(savedAt)}</span>
          {moved && (
            <span
              // border-current (not an /opacity modifier): these tokens are
              // light-dark() values, and the rest of the app never color-mixes them.
              className={`rounded-full border px-1.5 py-px font-medium tabular-nums ${
                moved.status === 'unlisted'
                  ? 'border-line text-muted'
                  : moved.favorable
                    ? 'border-current text-sig-green'
                    : 'border-current text-sig-amber'
              }`}
              title={
                moved.status === 'unlisted'
                  ? `${sourceLabel(source)} no longer posts this rung — your saved number is stale.`
                  : `${sourceLabel(source)} moved this line from ${moved.savedLine} to ${moved.currentLine} since you saved it — ${
                      moved.favorable ? 'in favor of' : 'against'
                    } your ${side}.`
              }
            >
              {/* The arrow is the LINE's direction; the color says whether that
                  direction helps the saved side (an under wants the number up). */}
              {moved.status === 'unlisted' ? (
                'line pulled'
              ) : (
                <>
                  {moved.delta > 0 ? '↑' : '↓'} {movementLabel(moved)}
                </>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {query.isPending ? (
          <span className="text-xs text-muted">loading…</span>
        ) : !fs ? (
          <span className="text-xs text-muted">no read</span>
        ) : (
          <>
            <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${tierTextClass(fs.tier, fs.side)}`}>
              <LeanArrow tier={fs.tier} side={fs.side} size={15} />
              {fsIsLean ? `${heatLabel(fs.tier, fs.side)} ${fs.side}` : 'No read'}
            </div>
            <div className="text-[11px] tabular-nums text-muted">
              FF {fs.score}
              {sideRate != null ? (
                <>
                  {' '}· Season {pct(sideRate)} {side}
                </>
              ) : null}
            </div>
            {fsIsLean && (
              <div
                className={`text-[10px] font-medium ${
                  fs.side === side ? 'text-sig-green' : 'text-sig-amber'
                }`}
              >
                {fs.side === side ? '✓ your side' : '✗ lean is opposite'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Above the row link (z-10) so removing never navigates. */}
      <button
        type="button"
        onClick={() => removeSavedProp({ sport, slug, stat, line, side, source })}
        aria-label={`Remove ${def.label} ${side} ${line} (${sourceLabel(source)})`}
        className="relative z-10 -mr-1 shrink-0 cursor-pointer rounded p-1 text-muted transition-colors hover:text-under"
      >
        ✕
      </button>
    </li>
  );
}

/** Compact relative time: "just now", "5m ago", "3h ago", "2d ago". */
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
