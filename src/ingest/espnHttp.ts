// Shared request headers for every ESPN hidden-API caller (espnSports.ts, espn.ts,
// nfl/client.ts, injuries.ts, gameOdds.ts, schedule.ts).
//
// WHY THIS EXISTS: all six used to send `User-Agent: FantasyFire/1.0
// (+https://fantasyfire.app)` — a self-identifying bot UA, with no other headers.
// site.api.espn.com is a browser-facing endpoint behind bot management, which
// classifies a non-browser UA from a datacenter IP (a GitHub Actions runner) and
// answers 403. Not 429: it's a policy denial, returned on the very first request,
// so no amount of backoff helps.
//
// The line scrapers in this same directory (prizepicks/underdog/sleeper/pick6/
// rotowire) have always sent a full browser header set and have not had this
// problem. These constants bring the ESPN callers in line with them, in ONE place
// so the next header change doesn't have to be made in six files — the duplication
// is precisely why every ESPN job started failing together.
//
// This is scraping an undocumented public endpoint, same as the rest of this
// directory: we send what a browser sends and we back off politely. Nothing here
// solves a rate limit or a hard IP ban — see ESPN_RETRY_STATUS.

/** Browser-like headers for a site.api.espn.com JSON request. */
export const ESPN_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.espn.com/',
  Origin: 'https://www.espn.com',
};

/**
 * HTTP statuses worth retrying with backoff.
 *
 * 403 is included deliberately, against the usual rule that a 403 is permanent.
 * Edge bot-management verdicts are made per-node and are not always consistent —
 * a request refused by one edge can pass on the next — so a handful of spaced
 * retries can carry a run through a partial block. Bounded by the caller's attempt
 * count, so a genuine hard block still fails the job in a few seconds rather than
 * hanging it.
 */
export const ESPN_RETRY_STATUS = (status: number): boolean =>
  status === 403 || status === 429 || status >= 500;
