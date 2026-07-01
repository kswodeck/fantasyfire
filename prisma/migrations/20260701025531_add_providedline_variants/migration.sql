-- DropIndex
DROP INDEX "ProvidedLine_sport_playerId_stat_source_gameDate_key";

-- AlterTable
ALTER TABLE "ProvidedLine" ADD COLUMN     "multiplier" DOUBLE PRECISION,
ADD COLUMN     "oddsType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProvidedLine_sport_playerId_stat_source_gameDate_line_key" ON "ProvidedLine"("sport", "playerId", "stat", "source", "gameDate", "line");
