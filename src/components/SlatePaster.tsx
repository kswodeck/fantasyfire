'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SlateResult } from '@/lib/types';
import type { Sport } from '@/lib/sports';
import { pct, signed, americanOdds } from '@/lib/format';
import { LeanArrow } from './LeanArrow';
import { TIER_TEXT } from '@/lib/tierStyle';

const PLACEHOLDER = 'LeBron James 25.5 points\nLuka Doncic over 8.5 assists -115\nJokic 45.5 PRA';

/**
 * Paste your REAL book lines and analyze them against the actual number (not our
 * median). Client island: POSTs to /api/v1/{sport}/slate and renders the ranked
 * results. Edge + EV appear only when you include odds.
 */
export function SlatePaster({ sport }: { sport: Sport }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<SlateResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/${sport}/slate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('request failed');
      const data: { results?: SlateResult[] } = await res.json();
      setResults(data.results ?? []);
    } catch {
      setError('Could not analyze the slate. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-line bg-surface-2 p-4">
      <h2 className="text-sm font-semibold">Paste your slate</h2>
      <p className="mt-1 text-xs text-muted">
        Paste your real book / PrizePicks lines — one per line, e.g.{' '}
        <code className="rounded bg-surface px-1 py-0.5">Jokic 45.5 PRA -110</code>. We read each
        against the actual number you enter (not our typical line), and add the edge &amp; EV when
        you include odds.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        spellCheck={false}
        placeholder={PLACEHOLDER}
        className="mt-3 w-full rounded-lg border border-line bg-surface p-2 font-mono text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={analyze}
          disabled={loading || !text.trim()}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>

      {results && (
        <>
          {results.length === 0 ? (
            <p className="mt-3 text-xs text-muted">Nothing recognized — check the format above.</p>
          ) : (
            <ol className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {results.map((r, i) =>
                r.matched && r.player && r.fireScore ? (
                  <li key={i}>
                    <Link
                      href={`/${sport}/${r.player.slug}?stat=${r.stat}&line=${r.line}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.player.fullName}</div>
                        <div className="truncate text-xs text-muted">
                          {r.fireScore.tier !== 'Pass' &&
                            (r.fireScore.side === 'over' ? 'Over ' : 'Under ')}
                          {r.line} {r.statShort}
                          {r.odds != null && ` @ ${americanOdds(r.odds)}`}
                          {r.overHitRate != null && ` · ${pct(r.overHitRate)} over`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`flex items-center justify-end gap-1 text-sm font-semibold ${TIER_TEXT[r.fireScore.tier] ?? 'text-muted'}`}
                        >
                          <LeanArrow tier={r.fireScore.tier} side={r.fireScore.side} size={13} />
                          {r.fireScore.tier}
                        </div>
                        <div className="text-[11px] tabular-nums text-muted">
                          FireScore {r.fireScore.score}
                          {r.evPerDollar != null && ` · EV ${signed(r.evPerDollar, 2)}/$1`}
                        </div>
                      </div>
                    </Link>
                  </li>
                ) : (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted"
                  >
                    <span className="min-w-0 truncate">{r.raw}</span>
                    <span className="shrink-0 italic">{r.reason}</span>
                  </li>
                ),
              )}
            </ol>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        FireScore is computed against the line you entered; edge &amp; EV compare recent history to
        your price — not a guarantee. 21+. Problem gambling? Call 1-800-GAMBLER.
      </p>
    </section>
  );
}
