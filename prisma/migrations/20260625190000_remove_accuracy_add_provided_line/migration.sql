-- Remove the Accuracy feature: drop the frozen-prediction snapshot table.
-- DropTable
DROP TABLE "ProjectionSnapshot";

-- Add the optional real-lines feed (off by default; see PROVIDED_LINES_ENABLED).
-- CreateTable
CREATE TABLE "ProvidedLine" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "stat" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "line" DOUBLE PRECISION NOT NULL,
    "overOdds" INTEGER,
    "underOdds" INTEGER,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvidedLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProvidedLine_sport_gameDate_idx" ON "ProvidedLine"("sport", "gameDate");

-- CreateIndex
CREATE INDEX "ProvidedLine_playerId_stat_idx" ON "ProvidedLine"("playerId", "stat");

-- CreateIndex
CREATE UNIQUE INDEX "ProvidedLine_sport_playerId_stat_source_gameDate_key" ON "ProvidedLine"("sport", "playerId", "stat", "source", "gameDate");

-- AddForeignKey
ALTER TABLE "ProvidedLine" ADD CONSTRAINT "ProvidedLine_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
