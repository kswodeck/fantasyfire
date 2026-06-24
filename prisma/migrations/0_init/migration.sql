-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conference" TEXT,
    "division" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" TEXT,
    "posBucket" TEXT,
    "jersey" TEXT,
    "height" TEXT,
    "weight" INTEGER,
    "college" TEXT,
    "country" TEXT,
    "draftYear" INTEGER,
    "draftRound" INTEGER,
    "draftNumber" INTEGER,
    "fromYear" INTEGER,
    "teamId" INTEGER,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStat" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "opponentTeamId" INTEGER NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "season" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "minutes" DOUBLE PRECISION,
    "wl" TEXT,
    "plusMinus" INTEGER,
    "points" INTEGER,
    "rebounds" INTEGER,
    "oreb" INTEGER,
    "dreb" INTEGER,
    "assists" INTEGER,
    "steals" INTEGER,
    "blocks" INTEGER,
    "turnovers" INTEGER,
    "fouls" INTEGER,
    "fgm" INTEGER,
    "fga" INTEGER,
    "fg3m" INTEGER,
    "fg3a" INTEGER,
    "ftm" INTEGER,
    "fta" INTEGER,
    "atBats" INTEGER,
    "hits" INTEGER,
    "doubles" INTEGER,
    "triples" INTEGER,
    "homeRuns" INTEGER,
    "runs" INTEGER,
    "rbi" INTEGER,
    "walks" INTEGER,
    "strikeouts" INTEGER,
    "stolenBases" INTEGER,
    "totalBases" INTEGER,
    "hbp" INTEGER,
    "outs" INTEGER,
    "hitsAllowed" INTEGER,
    "runsAllowed" INTEGER,
    "earnedRuns" INTEGER,
    "walksAllowed" INTEGER,
    "strikeoutsPitched" INTEGER,
    "pitcherWin" BOOLEAN,

    CONSTRAINT "PlayerGameStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_sport_externalId_key" ON "Team"("sport", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_sport_abbreviation_key" ON "Team"("sport", "abbreviation");

-- CreateIndex
CREATE INDEX "Player_sport_lastName_idx" ON "Player"("sport", "lastName");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sport_externalId_key" ON "Player"("sport", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sport_slug_key" ON "Player"("sport", "slug");

-- CreateIndex
CREATE INDEX "Game_sport_date_idx" ON "Game"("sport", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Game_sport_externalId_key" ON "Game"("sport", "externalId");

-- CreateIndex
CREATE INDEX "PlayerGameStat_sport_playerId_gameDate_idx" ON "PlayerGameStat"("sport", "playerId", "gameDate");

-- CreateIndex
CREATE INDEX "PlayerGameStat_sport_opponentTeamId_season_idx" ON "PlayerGameStat"("sport", "opponentTeamId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameStat_playerId_gameId_key" ON "PlayerGameStat"("playerId", "gameId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

