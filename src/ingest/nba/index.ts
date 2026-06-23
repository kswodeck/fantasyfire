// src/ingest/nba/index.ts
export { NbaStatsClient, toPosBucket, slugify } from './client';
export type { NbaStatsClientOptions } from './client';
export { parseMatchup } from './matchup';
export type { ParsedMatchup } from './matchup';
export {
  selectResultSet,
  rowsFromResultSet,
  assertColumns,
  toNum,
  toNumOrNull,
  toStr,
  toStrOrNull,
  parseMinutes,
} from './columnar';
export {
  NBA_STATS_BASE_URL,
  NBA_STATS_HEADERS,
  NbaHttpError,
  NbaTimeoutError,
  NbaLikelyBlockedError,
  RateLimiter,
  fetchNbaJson,
} from './http';
export type { FetchOptions } from './http';
export type {
  NbaResultSet,
  NbaStatsResponse,
  NbaRow,
  PlayerIndexRow,
  PlayerGameLogRow,
} from './types';
