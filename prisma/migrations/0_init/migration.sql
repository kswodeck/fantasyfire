-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "nbaId" INTEGER NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conference" TEXT,
    "division" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "nbaId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" TEXT,
    "posBucket" TEXT,
    "teamId" INTEGER,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" SERIAL NOT NULL,
    "nbaId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStat" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "opponentTeamId" INTEGER NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "season" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "minutes" DOUBLE PRECISION,
    "points" INTEGER NOT NULL,
    "rebounds" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "steals" INTEGER NOT NULL,
    "blocks" INTEGER NOT NULL,
    "turnovers" INTEGER NOT NULL,
    "fgm" INTEGER NOT NULL,
    "fga" INTEGER NOT NULL,
    "fg3m" INTEGER NOT NULL,
    "fg3a" INTEGER NOT NULL,
    "ftm" INTEGER NOT NULL,
    "fta" INTEGER NOT NULL,

    CONSTRAINT "PlayerGameStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_nbaId_key" ON "Team"("nbaId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_abbreviation_key" ON "Team"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "Player_nbaId_key" ON "Player"("nbaId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE INDEX "Player_lastName_idx" ON "Player"("lastName");

-- CreateIndex
CREATE UNIQUE INDEX "Game_nbaId_key" ON "Game"("nbaId");

-- CreateIndex
CREATE INDEX "Game_date_idx" ON "Game"("date");

-- CreateIndex
CREATE INDEX "PlayerGameStat_playerId_gameDate_idx" ON "PlayerGameStat"("playerId", "gameDate");

-- CreateIndex
CREATE INDEX "PlayerGameStat_opponentTeamId_season_idx" ON "PlayerGameStat"("opponentTeamId", "season");

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

