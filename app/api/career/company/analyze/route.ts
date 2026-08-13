import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { sseStream } from "@/lib/sse";
import { LLMUsage } from "@/lib/ai";
import { analyzeCompany } from "@/lib/agents/company/analyze";

// 검색 6회 + LLM 2회가 붙는 무거운 라우트
export const maxDuration = 60;

const ANALYZE_LIMIT = 5;
const ANALYZE_WINDOW_MS = 10 * 60 * 1000;

const MAX_NAME_LEN = 60;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rl = rateLimit(`company:${user.id}`, ANALYZE_LIMIT, ANALYZE_WINDOW_MS);
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

  const body = await req.json();
  const name = String(body.name ?? "").trim().slice(0, MAX_NAME_LEN);

  if (!name) {
    return new Response(JSON.stringify({ error: "회사명을 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return sseStream(
    async (send) => {
      // 실행 기록 (비용·이력이 여기 남는다)
      const result = await prisma.result.create({
        data: {
          userId: user.id,
          mode: "career",
          kind: "company",
          topic: name,
        },
      });

      // LLM 호출 한 건을 로그로 남긴다
      const logUsage = async (stage: string, output: unknown, usage: LLMUsage) => {
        const now = new Date();
        const log = await prisma.agentLog.create({
          data: {
            resultId: result.id,
            stage,
            persona: "analyst",
            status: "success",
            output: output as Prisma.InputJsonValue,
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
      };

      const company = await prisma.company.upsert({
        where: { userId_name: { userId: user.id, name } },
        create: { userId: user.id, name },
        update: {},
      });

      // 회사 레벨만 본다. 직무·공고는 책상에서 '지원 건'을 만들 때 다룬다.
      const run = await analyzeCompany(name, {
        progress: (m) => send({ type: "progress", message: m }),
      });

      await logUsage("company", run.analysis, run.usages[0]);
      if (run.usages[1]) await logUsage("company", run.analysis, run.usages[1]);

      await prisma.company.update({
        where: { id: company.id },
        data: {
          analysis: run.analysis as unknown as Prisma.InputJsonValue,
          analyzedAt: new Date(),
          lastResultId: result.id,
        },
      });

      send({ type: "company", companyId: company.id, analysis: run.analysis });

      await prisma.result.update({
        where: { id: result.id },
        data: { resultData: { companyId: company.id } as Prisma.InputJsonValue },
      });

      send({ type: "complete", companyId: company.id });
    },
    { label: "기업 분석", errorMessage: "기업 분석에 실패했습니다." }
  );
}
