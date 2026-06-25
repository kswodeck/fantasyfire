'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useFavorites } from '@/hooks/useFavorites';
import { useSavedProps } from '@/hooks/useSavedProps';
import { removeFavorite } from '@/lib/favorites';
import { removeSavedProp, type SavedProp } from '@/lib/savedProps';
import { useHitRate } from '@/hooks/useHitRate';
import { STAT_DEFS } from '@/lib/stats';
import { SPORTS, SPORT_LIST, type Sport } from '@/lib/sports';
import { pct } from '@/lib/format';
import { tierTextClass } from '@/lib/tierStyle';
import { LeanArrow } from './LeanArrow';
import { SideArrow } from './SideArrow';

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

  const groups = useMemo(() => {
    const byPlayer = new Map<string, PlayerEntry>();
    const keyOf = (sport: Sport, slug: string) => `${sport}:${slug}`;

    // Favorites first so favorite-only players keep their newest-first order.
    for (const f of favorites) {
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
    for (const p of props) {
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
          isFavorite: false,
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
  }, [favorites, props]);

  if (!hydrated) {
    return <p className="mt-6 text-sm text-muted">Loading your Playbook…</p>;
  }

  if (groups.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
        <p>
          Your Playbook is empty. Open any player and tap{' '}
          <span className="font-medium text-foreground">☆ Save player</span> to pin them, or{' '}
          <span className="font-medium text-foreground">★ Over / Under</span> under the verdict to
          track a specific prop.
        </p>
        <p className="mt-3 flex flex-wrap gap-3">
          {SPORT_LIST.map((s) => (
            <Link
              key={s}
              href={`/${s}/players`}
              className="font-medium text-brand hover:text-brand-strong"
            >
              Browse {SPORTS[s].name} players →
            </Link>
          ))}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
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

      <p className="text-xs leading-relaxed text-muted">
        Saved on this device only (browser storage) — they don&rsquo;t sync across devices and
        clear if you clear site data. No account, no tracking.
      </p>
    </div>
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
                key={`${p.stat}:${p.line}:${p.side}`}
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
              <PropRow key={`${p.stat}:${p.line}:${p.side}`} prop={p} />
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

/** A single saved prop with a live read fetched on demand (only while expanded). */
function PropRow({ prop }: { prop: SavedProp }) {
  const { sport, slug, stat, line, side, savedAt } = prop;
  const def = STAT_DEFS[stat];
  const query = useHitRate({ sport, slug, stat, line });
  const research = query.data;

  const season = research?.windows.find((w) => w.window === 'season')?.hitRate;
  const overRate = season?.hitRateOver ?? null;
  const sideRate = overRate === null ? null : side === 'over' ? overRate : 1 - overRate;
  const fs = research?.verdict.fireScore;
  const fsIsLean = fs ? fs.tier !== 'No lean' && fs.tier !== 'Pass' : false;

  return (
    <li className="flex flex-col gap-1.5 border-b border-line px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {def.label}{' '}
          <span className={`tabular-nums ${side === 'over' ? 'text-over' : 'text-under'}`}>
            {side === 'over' ? 'Over' : 'Under'} {line}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">Saved {relativeTime(savedAt)}</div>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs">
        {query.isPending ? (
          <span className="text-muted">loading…</span>
        ) : !fs ? (
          <span className="text-muted">no read</span>
        ) : (
          <div className="flex flex-col items-start gap-0.5 sm:items-end">
            <span className="text-muted">
              Season{' '}
              <span className="font-semibold tabular-nums text-foreground">{pct(sideRate)}</span>{' '}
              {side}
            </span>
            <span className={`inline-flex items-center gap-1 font-medium ${tierTextClass(fs.tier, fs.side)}`}>
              <LeanArrow tier={fs.tier} side={fs.side} size={13} />
              {fsIsLean ? (
                <>
                  {fs.side === 'over' ? 'Over' : 'Under'} {fs.tier}
                  <span className="text-muted">· {fs.score}</span>
                  {fs.side === side ? (
                    <span className="ml-0.5 text-over">✓ your side</span>
                  ) : (
                    <span className="ml-0.5 text-under">opposite</span>
                  )}
                </>
              ) : (
                <span className="text-muted">no lean · {fs.score}</span>
              )}
            </span>
          </div>
        )}
        <Link
          href={`/${sport}/${slug}/${stat}?line=${line}`}
          className="font-medium text-brand hover:text-brand-strong"
        >
          View →
        </Link>
        <button
          type="button"
          onClick={() => removeSavedProp({ sport, slug, stat, line, side })}
          aria-label={`Remove ${def.label} ${side} ${line}`}
          className="text-muted transition-colors hover:text-under"
        >
          ✕
        </button>
      </div>
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
