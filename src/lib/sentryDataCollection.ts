// Shared Sentry `dataCollection` settings for every runtime (browser, server, edge,
// ingest). The site has no accounts and promises no cookies, so keep events to the
// error itself: no user info (IP), cookies, or request/response bodies. Headers and
// query params stay on (Sentry still filters sensitive values) — they help reproduce.
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpBodies: [],
};
