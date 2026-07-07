-- AlterTable
ALTER TABLE "PlayerGameStat" ADD COLUMN     "blockedShots" INTEGER,
ADD COLUMN     "faceoffsWon" INTEGER,
ADD COLUMN     "goals" INTEGER,
ADD COLUMN     "goalsAgainst" INTEGER,
ADD COLUMN     "hitsDelivered" INTEGER,
ADD COLUMN     "saves" INTEGER,
ADD COLUMN     "shots" INTEGER,
ADD COLUMN     "shotsAgainst" INTEGER,
ADD COLUMN     "shotsOnGoal" INTEGER,
ADD COLUMN     "shotsOnTarget" INTEGER,
ADD COLUMN     "started" BOOLEAN;
