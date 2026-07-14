// Tiny RSS 2.0 builder for the daily-leans feeds (docs/MARKETING.md §4:
// feeds are free distribution — readers, aggregators, and AI assistants
// consume them). Pure string assembly; no deps.

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface RssItem {
  title: string;
  link: string;
  /** Plain-text description (multi-line ok). */
  description: string;
  /** Stable id so readers don't re-surface the same day's item. */
  guid: string;
  pubDate: Date;
}

export function rssFeed(opts: {
  title: string;
  link: string;
  description: string;
  items: RssItem[];
}): string {
  const items = opts.items
    .map(
      (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      <description>${esc(i.description)}</description>
      <guid isPermaLink="false">${esc(i.guid)}</guid>
      <pubDate>${i.pubDate.toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(opts.title)}</title>
    <link>${esc(opts.link)}</link>
    <description>${esc(opts.description)}</description>
${items}
  </channel>
</rss>`;
}
