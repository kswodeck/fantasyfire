-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "college" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "draftNumber" INTEGER,
ADD COLUMN     "draftRound" INTEGER,
ADD COLUMN     "draftYear" INTEGER,
ADD COLUMN     "fromYear" INTEGER;

-- AlterTable
ALTER TABLE "PlayerGameStat" ADD COLUMN     "dreb" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fouls" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "oreb" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plusMinus" INTEGER,
ADD COLUMN     "wl" TEXT;

