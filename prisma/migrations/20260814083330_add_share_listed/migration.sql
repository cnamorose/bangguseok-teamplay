-- AlterTable
ALTER TABLE "Share" ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Share_listed_revoked_createdAt_idx" ON "Share"("listed", "revoked", "createdAt" DESC);
