import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CompanyAnalysis, RoleAnalysis } from "@/lib/agents/company/types";
import { getInterviewer } from "./interviewers";
import { AskContext, Turn } from "./ask";

// 면접 한 판에 필요한 재료를 모은다.
// 세션을 시작할 때와 답변을 받을 때 둘 다 쓰므로 여기로 뺐다.

export async function buildContext(
  interview: {
    id: string;
    userId: string;
    applicationId: string | null;
    interviewerIds: string[];
    maxTurns: number;
    turns: Prisma.JsonValue[];
  }
): Promise<AskContext> {
  const application = interview.applicationId
    ? await prisma.application.findUnique({
        where: { id: interview.applicationId },
        include: {
          company: true,
          essays: { where: { NOT: { content: "" } }, orderBy: { order: "asc" } },
        },
      })
    : null;

  const experiences = await prisma.experience.findMany({
    where: { userId: interview.userId },
    orderBy: [{ starred: "desc" }, { updatedAt: "desc" }],
    take: 6,
    select: { title: true, role: true, action: true, impact: true },
  });

  const turns = interview.turns as unknown as Turn[];
  // 실제로 '답한' 횟수만 센다. 자판을 두드린 입력은 답변이 아니므로 예산을 깎지 않는다
  const answered = turns.filter((t) => t.role === "candidate" && !t.invalid).length;

  return {
    companyName: application?.company.name ?? "지원 회사",
    role: application?.role ?? "지원 직무",
    interviewers: interview.interviewerIds.map(getInterviewer),
    company: (application?.company.analysis as CompanyAnalysis | null) ?? null,
    roleAnalysis: (application?.roleAnalysis as RoleAnalysis | null) ?? null,
    essays: (application?.essays ?? []).map((e) => ({ prompt: e.prompt, content: e.content })),
    experiences,
    turns,
    remaining: Math.max(0, interview.maxTurns - answered),
  };
}

/** LLM 호출 한 건을 실행 기록으로 남긴다 (비용 집계용) */
export async function logInterviewUsage(
  userId: string,
  topic: string,
  stage: string,
  usage: { inputTokens: number; outputTokens: number; cost: number }
) {
  const result = await prisma.result.create({
    data: { userId, mode: "career", kind: "interview", topic },
  });
  const now = new Date();
  const log = await prisma.agentLog.create({
    data: {
      resultId: result.id,
      stage,
      persona: "interviewer",
      status: "success",
      startedAt: now,
      completedAt: now,
    },
  });
  await prisma.apiUsage.create({
    data: {
      agentLogId: log.id,
      provider: "openai",
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      cost: usage.cost,
    },
  });
}
