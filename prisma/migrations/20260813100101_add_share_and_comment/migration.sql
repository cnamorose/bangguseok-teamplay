-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'link',
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Share_token_key" ON "Share"("token");

-- CreateIndex
CREATE INDEX "Share_ownerId_createdAt_idx" ON "Share"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Share_kind_targetId_idx" ON "Share"("kind", "targetId");

-- CreateIndex
CREATE INDEX "Comment_shareId_createdAt_idx" ON "Comment"("shareId", "createdAt");

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
