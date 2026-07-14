-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assembly" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchPersona" TEXT NOT NULL,
    "generatePersona" TEXT NOT NULL,
    "organizePersona" TEXT NOT NULL,
    "visualizePersona" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resultData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "output" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "agentLogId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Assembly" ADD CONSTRAINT "Assembly_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_agentLogId_fkey" FOREIGN KEY ("agentLogId") REFERENCES "AgentLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
