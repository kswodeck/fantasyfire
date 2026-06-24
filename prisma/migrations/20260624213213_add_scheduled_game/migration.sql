-- CreateTable
CREATE TABLE "ScheduledGame" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "status" TEXT,
    "homeProbablePitcher" TEXT,
    "awayProbablePitcher" TEXT,

    CONSTRAINT "ScheduledGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledGame_sport_date_idx" ON "ScheduledGame"("sport", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledGame_sport_externalId_key" ON "ScheduledGame"("sport", "externalId");

-- AddForeignKey
ALTER TABLE "ScheduledGame" ADD CONSTRAINT "ScheduledGame_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledGame" ADD CONSTRAINT "ScheduledGame_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
