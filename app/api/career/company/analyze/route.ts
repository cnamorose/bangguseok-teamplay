import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { sseStream } from "@/lib/sse";
import { LLMUsage } from "@/lib/ai";
import { analyzeCompany, analyzeRole } from "@/lib/agents/company/analyze";
import { CompanyAnalysis } from "@/lib/agents/company/types";

// 검색 6회 + LLM 2~3회가 붙는 무거운 라우트
export const maxDuration = 60;

const ANALYZE_LIMIT = 5;
const ANALYZE_WINDOW_MS = 10 * 60 * 1000;

const MAX_NAME_LEN = 60;
const MAX_ROLE_LEN = 60;

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
  const role = String(body.role ?? "").trim().slice(0, MAX_ROLE_LEN);
  // 이미 분석해 둔 회사면 회사 레벨은 건너뛰고 직무만 새로 뽑는다
  const reuse = body.reuse === true;

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
          topic: role ? `${name} · ${role}` : name,
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

      // ── 1차: 회사 레벨 ──
      let analysis = company.analysis as CompanyAnalysis | null;

      if (!reuse || !analysis) {
        const run = await analyzeCompany(name, { progress: (m) => send({ type: "progress", message: m }) });
        analysis = run.analysis;

        await logUsage("company", run.analysis, run.usages[0]);
        if (run.usages[1]) await logUsage("company", run.analysis, run.usages[1]);

        await prisma.company.update({
          where: { id: company.id },
          data: {
            analysis: analysis as unknown as Prisma.InputJsonValue,
            analyzedAt: new Date(),
            lastResultId: result.id,
          },
        });
      } else {
        send({ type: "progress", message: "📁 저장해 둔 회사 분석을 씁니다." });
      }

      send({ type: "company", companyId: company.id, analysis });

      // ── 2차: 직무 레벨 (직무를 넣었을 때만) ──
      if (role) {
        const application = await prisma.application.upsert({
          where: { companyId_role: { companyId: company.id, role } },
          create: { userId: user.id, companyId: company.id, role },
          update: {},
        });

        const run = await analyzeRole(name, role, analysis, {
          progress: (m) => send({ type: "progress", message: m }),
        });

        await logUsage("role", run.analysis, run.usages[0]);

        await prisma.application.update({
          where: { id: application.id },
          data: {
            roleAnalysis: run.analysis as unknown as Prisma.InputJsonValue,
            analyzedAt: new Date(),
            lastResultId: result.id,
          },
        });

        send({ type: "role", applicationId: application.id, analysis: run.analysis });
      }

      await prisma.result.update({
        where: { id: result.id },
        data: { resultData: { companyId: company.id } as Prisma.InputJsonValue },
      });

      send({ type: "complete", companyId: company.id });
    },
    { label: "기업 분석", errorMessage: "기업 분석에 실패했습니다." }
  );
}
