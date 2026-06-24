-- CreateTable
CREATE TABLE "ProjectionSnapshot" (
    "id" SERIAL NOT NULL,
    "sport" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "stat" TEXT NOT NULL,
    "line" DOUBLE PRECISION NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "predictedSide" TEXT NOT NULL,
    "overHitRate" DOUBLE PRECISION,
    "wilsonLower" DOUBLE PRECISION,
    "fireScore" INTEGER NOT NULL,
    "fireTier" TEXT NOT NULL,
    "targetGameDate" TIMESTAMP(3),
    "actualValue" DOUBLE PRECISION,
    "outcome" TEXT,
    "graded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectionSnapshot_sport_graded_idx" ON "ProjectionSnapshot"("sport", "graded");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectionSnapshot_playerId_stat_snapshotDate_key" ON "ProjectionSnapshot"("playerId", "stat", "snapshotDate");

-- AddForeignKey
ALTER TABLE "ProjectionSnapshot" ADD CONSTRAINT "ProjectionSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
