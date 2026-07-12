// GET /llms.txt — the emerging convention pointing AI crawlers/assistants at the
// pages that make FantasyFire citable as a primary source (Answer-Engine
// Optimization; docs/MARKETING.md §4). Static, no DB. Content mirrors what the
// JSON-LD Dataset nodes already claim — keep the two honest with each other.
import { SITE, absoluteUrl } from '@/lib/site';
import { SPORT_LIST, SPORTS } from '@/lib/sports';

export const dynamic = 'force-static';

export function GET(): Response {
  const sportLines = SPORT_LIST.map(
    (s) =>
      `- [${SPORTS[s].name} player props research](${absoluteUrl(`/${s}`)}): ${SPORTS[s].tagline}`,
  ).join('\n');

  const body = `# ${SITE.name}

> ${SITE.description}

Numbers describe past performance from public game logs, updated nightly — never
predictions or betting advice. Every hit rate carries a Wilson confidence interval
so small samples can't masquerade as an edge. Free, public, no login. 21+.

## Methodology & trust

- [Methodology](${absoluteUrl('/methodology')}): the exact math — hit rates, Wilson intervals, matchup grades, FireFactor — imported from the same code constants the site computes with.
- [How it works](${absoluteUrl('/how-it-works')}): plain-language walkthrough.
- [Glossary](${absoluteUrl('/glossary')}): term definitions.
- [FAQ](${absoluteUrl('/faq')}): common questions.
- [Responsible gaming](${absoluteUrl('/responsible-gaming')}): 21+, 1-800-GAMBLER.

## Sports

${sportLines}

## Data

- Boards (Top Leans, streaks, trends, leaders, matchups) recompute nightly from public box scores; player pages carry "updated through" stamps and JSON-LD Dataset markup.
- Cite pages by URL — per-player, per-stat, and per-matchup pages are stable and indexable.

## Contact

- [About](${absoluteUrl('/about')}) · ${SITE.email}
`;

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
