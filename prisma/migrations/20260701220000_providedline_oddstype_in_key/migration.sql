-- oddsType joins the ProvidedLine unique key so a payout variant can legitimately
-- share a line number with the standard line (or another variant) without one
-- silently overwriting the other at ingest. NULL never participates in Postgres
-- uniqueness, so the column becomes NOT NULL first: existing NULLs (books with no
-- variant concept) backfill to 'standard', which the app already normalizes to the
-- plain-line kind.

-- Backfill + tighten the column
UPDATE "ProvidedLine" SET "oddsType" = 'standard' WHERE "oddsType" IS NULL;
ALTER TABLE "ProvidedLine" ALTER COLUMN "oddsType" SET NOT NULL,
                           ALTER COLUMN "oddsType" SET DEFAULT 'standard';

-- Collapse any rows that collide under the new key (same line, same oddsType —
-- possible if two fetches raced before this migration): keep the newest fetch.
DELETE FROM "ProvidedLine" a
USING "ProvidedLine" b
WHERE a."sport" = b."sport"
  AND a."playerId" = b."playerId"
  AND a."stat" = b."stat"
  AND a."source" = b."source"
  AND a."gameDate" = b."gameDate"
  AND a."line" = b."line"
  AND a."oddsType" = b."oddsType"
  AND (a."fetchedAt" < b."fetchedAt" OR (a."fetchedAt" = b."fetchedAt" AND a."id" < b."id"));

-- DropIndex
DROP INDEX "ProvidedLine_sport_playerId_stat_source_gameDate_line_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProvidedLine_sport_playerId_stat_source_gameDate_line_oddsT_key" ON "ProvidedLine"("sport", "playerId", "stat", "source", "gameDate", "line", "oddsType");
