-- AlterTable
ALTER TABLE "ScheduledGame" ADD COLUMN     "gameTotal" DOUBLE PRECISION,
ADD COLUMN     "homeFavorite" BOOLEAN,
ADD COLUMN     "homeSpread" DOUBLE PRECISION,
ADD COLUMN     "oddsProvider" TEXT;

-- CreateTable
CREATE TABLE "PlayerInjury" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "rawStatus" TEXT NOT NULL,
    "detail" TEXT,
    "comment" TEXT,
    "reportedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerInjury_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerInjury_playerId_key" ON "PlayerInjury"("playerId");

-- CreateIndex
CREATE INDEX "PlayerInjury_sport_idx" ON "PlayerInjury"("sport");

-- AddForeignKey
ALTER TABLE "PlayerInjury" ADD CONSTRAINT "PlayerInjury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
