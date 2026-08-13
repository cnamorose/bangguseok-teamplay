-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raw" TEXT,
    "title" TEXT NOT NULL,
    "period" TEXT,
    "role" TEXT,
    "situation" TEXT,
    "action" TEXT,
    "impact" TEXT,
    "learning" TEXT,
    "message" TEXT,
    "tags" TEXT[],
    "gaps" JSONB,
    "organizedAt" TIMESTAMP(3),
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Experience_userId_starred_updatedAt_idx" ON "Experience"("userId", "starred" DESC, "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
