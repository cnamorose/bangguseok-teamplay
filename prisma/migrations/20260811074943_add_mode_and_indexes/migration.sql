-- AlterTable
ALTER TABLE "AgentLog" ADD COLUMN     "error" TEXT;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'study',
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetType" TEXT;

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'article',
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'study',
ALTER COLUMN "assemblyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'study';

-- CreateIndex
CREATE INDEX "AgentLog_resultId_startedAt_idx" ON "AgentLog"("resultId", "startedAt");

-- CreateIndex
CREATE INDEX "ApiUsage_agentLogId_idx" ON "ApiUsage"("agentLogId");

-- CreateIndex
CREATE INDEX "Assembly_userId_idx" ON "Assembly"("userId");

-- CreateIndex
CREATE INDEX "Evaluation_userId_mode_createdAt_idx" ON "Evaluation"("userId", "mode", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Evaluation_targetType_targetId_idx" ON "Evaluation"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Result_userId_mode_createdAt_idx" ON "Result"("userId", "mode", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Result_assemblyId_idx" ON "Result"("assemblyId");
