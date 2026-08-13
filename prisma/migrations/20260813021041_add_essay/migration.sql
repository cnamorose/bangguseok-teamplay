-- CreateTable
CREATE TABLE "Essay" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'free',
    "maxChars" INTEGER,
    "content" TEXT NOT NULL DEFAULT '',
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "history" JSONB[],
    "questions" JSONB,
    "usedExpIds" TEXT[],
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Essay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Essay_applicationId_order_idx" ON "Essay"("applicationId", "order");

-- AddForeignKey
ALTER TABLE "Essay" ADD CONSTRAINT "Essay_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
