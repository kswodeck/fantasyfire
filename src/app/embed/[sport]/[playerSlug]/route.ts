// GET /embed/{sport}/{slug}?stat=&line=&theme=
//
// A self-contained, chrome-less hit-rate card for third-party sites to <iframe>.
// Returned as a Route Handler (not a page) so it skips the site layout entirely —
// zero JS, tiny, CDN-cacheable, and it carries a "Powered by FantasyFire" backlink
// (the whole point: a self-replicating link engine). Framing is allowed for this
// path via the CSP in next.config.ts.
import type { NextRequest } from 'next/server';
import { getPlayerResearch } from '@/lib/server/players';
import { absoluteUrl } from '@/lib/site';
import { isSport, SPORTS } from '@/lib/sports';
import { isPropStat } from '@/lib/propStats';
import { STAT_DEFS, type StatKey } from '@/lib/stats';
import { pct } from '@/lib/format';
import { lineSchema, statKeySchema } from '@/lib/schemas';

export const revalidate = 3600;

const BADGE_COLOR: Record<string, string> = { High: '#15803d', Medium: '#b45309', Low: '#b91c1c' };

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function notFoundCard(): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><style>body{margin:0;font:14px system-ui;color:#57534e;padding:16px}</style></head><body>Player not found · <a href="${esc(absoluteUrl('/'))}" target="_blank" rel="noopener">FantasyFire</a></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ sport: string; playerSlug: string }> },
) {
  const { sport, playerSlug } = await ctx.params;
  if (!isSport(sport)) return notFoundCard();

  const sp = request.nextUrl.searchParams;
  const statParam = statKeySchema.safeParse(sp.get('stat') ?? undefined);
  const wantStat = statParam.success && isPropStat(sport, statParam.data) ? statParam.data : undefined;
  const theme = sp.get('theme') === 'light' ? 'light' : sp.get('theme') === 'dark' ? 'dark' : 'auto';

  const research = await getPlayerResearch(sport, playerSlug, wantStat as StatKey | undefined);
  if (!research) return notFoundCard();

  // Optional explicit line override (else the page's typical line).
  const lineParam = lineSchema.safeParse(sp.get('line') ?? undefined);
  const def = STAT_DEFS[research.stat];
  const cfg = SPORTS[sport];

  const l10 = research.windows.find((w) => w.window === '10');
  const season = research.windows.find((w) => w.window === 'season');
  const win = l10 && l10.hitRate.decided > 0 ? l10 : season;
  const hr = win?.hitRate ?? null;
  const conf = win?.confidence ?? null;
  const windowLabel = win?.window === '10' ? 'last 10' : 'season';
  const overPct = hr?.hitRateOver ?? null;
  const badge = conf?.badge ?? 'Low';
  const badgeColor = BADGE_COLOR[badge] ?? '#57534e';
  const line = lineParam.success ? lineParam.data : research.line;
  const team = research.player.teamAbbreviation ?? '';
  const playerUrl = absoluteUrl(`/${sport}/${research.player.slug}`);
  const overWidth = overPct === null ? 0 : Math.round(overPct * 100);

  // prefers-color-scheme by default; ?theme forces one side via a data attribute.
  const themeAttr = theme === 'auto' ? '' : ` data-theme="${theme}"`;

  const html = `<!doctype html>
<html lang="en"${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(research.player.fullName)} ${esc(def.label)} hit rate · FantasyFire</title>
<style>
  :root{color-scheme:light dark;--bg:#fff;--fg:#1c1917;--muted:#57534e;--line:#e7e5e4;--over:#15803d;--track:#f5f5f4;--brand:#c2410c}
  @media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--line:#2f2b29;--over:#4ade80;--track:#0c0a09;--brand:#fb923c}}
  html[data-theme=light]{--bg:#fff;--fg:#1c1917;--muted:#57534e;--line:#e7e5e4;--over:#15803d;--track:#f5f5f4;--brand:#c2410c;color-scheme:light}
  html[data-theme=dark]{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--line:#2f2b29;--over:#4ade80;--track:#0c0a09;--brand:#fb923c;color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
  .card{display:block;text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:14px;padding:16px 18px;max-width:380px;margin:0 auto}
  .top{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
  .flame{width:16px;height:16px;flex:none}
  .brand{font-weight:700;color:var(--fg)}
  .brand span{color:var(--brand)}
  .name{margin:10px 0 2px;font-size:20px;font-weight:800;line-height:1.15}
  .meta{font-size:13px;color:var(--muted)}
  .rate{display:flex;align-items:flex-end;gap:12px;margin:12px 0 6px}
  .pct{font-size:46px;font-weight:800;color:var(--over);line-height:1}
  .rlabel{font-size:13px;color:var(--muted);padding-bottom:5px}
  .track{height:8px;border-radius:99px;background:var(--track);overflow:hidden;margin:6px 0 10px}
  .fill{height:100%;background:var(--over)}
  .badge{display:inline-block;font-size:12px;font-weight:600;border:1.5px solid;border-radius:99px;padding:3px 10px}
  .foot{margin-top:12px;font-size:11px;color:var(--muted);display:flex;justify-content:space-between;gap:8px}
  .pw{color:var(--brand);font-weight:600;white-space:nowrap}
</style>
</head>
<body>
<a class="card" href="${esc(playerUrl)}" target="_blank" rel="noopener">
  <div class="top">
    <svg class="flame" viewBox="0 0 24 24" fill="var(--brand)" aria-hidden="true"><path d="M12 2c1 3-1 5-2 6-2 2-3 4-3 7a5 5 0 0 0 10 0c0-2-1-3-1-4 2 1 2 3 2 4a7 7 0 1 1-14 0c0-5 5-7 8-13z"/></svg>
    <span class="brand">Fantasy<span>Fire</span></span>
    <span>· ${esc(cfg.name)}</span>
  </div>
  <div class="name">${esc(research.player.fullName)}</div>
  <div class="meta">${esc([team, def.label].filter(Boolean).join(' · '))} · over ${line}</div>
  <div class="rate">
    <span class="pct">${overPct === null ? '—' : esc(pct(overPct))}</span>
    <span class="rlabel">${hr ? `${hr.overs} of ${hr.decided} · ${windowLabel}` : windowLabel}</span>
  </div>
  <div class="track"><div class="fill" style="width:${overWidth}%"></div></div>
  <span class="badge" style="color:${badgeColor};border-color:${badgeColor}">${badge} confidence${conf ? ` · ${esc(pct(conf.interval.lower))}–${esc(pct(conf.interval.upper))}` : ''}</span>
  <div class="foot">
    <span>Past games, not advice · 95% Wilson</span>
    <span class="pw">View on FantasyFire ↗</span>
  </div>
</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Cache at the CDN; matches the player page ISR window.
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
