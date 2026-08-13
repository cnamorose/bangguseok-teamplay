import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { sseStream } from "@/lib/sse";
import { countChars } from "@/lib/agents/length";
import { draftEssay } from "@/lib/agents/essay/draft";
import { guessKind } from "@/lib/agents/essay/kinds";
import { CompanyAnalysis, RoleAnalysis } from "@/lib/agents/company/types";

export const maxDuration = 60;

const DRAFT_LIMIT = 10;
const DRAFT_WINDOW_MS = 10 * 60 * 1000;

const MAX_PROMPT_LEN = 500;
const MAX_TARGET = 5000;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rl = rateLimit(`essay:${user.id}`, DRAFT_LIMIT, DRAFT_WINDOW_MS);
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

  const body = await req.json();
  const applicationId = String(body.applicationId ?? "");
  const promptText = String(body.prompt ?? "").trim().slice(0, MAX_PROMPT_LEN);
  const experienceIds: string[] = Array.isArray(body.experienceIds)
    ? body.experienceIds.slice(0, 3).map(String)
    : [];
  const maxChars =
    Number(body.maxChars) > 0 ? Math.min(Number(body.maxChars), MAX_TARGET) : undefined;
  const tone = ["result", "process", "plain"].includes(body.tone) ? body.tone : undefined;
  const essayId = body.essayId ? String(body.essayId) : null;

  if (!applicationId || !promptText) {
    return new Response(JSON.stringify({ error: "지원 건과 문항이 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (experienceIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "이 문항에 쓸 경험을 먼저 골라주세요." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { company: true },
  });

  if (!application || application.userId !== user.id) {
    return new Response(JSON.stringify({ error: "지원 건을 찾을 수 없습니다." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const experiences = await prisma.experience.findMany({
    where: { id: { in: experienceIds }, userId: user.id },
  });

  if (experiences.length === 0) {
    return new Response(JSON.stringify({ error: "경험을 찾을 수 없습니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const kind = typeof body.kind === "string" && body.kind ? body.kind : guessKind(promptText);

  return sseStream(
    async (send) => {
      const result = await prisma.result.create({
        data: {
          userId: user.id,
          mode: "career",
          kind: "essay",
          topic: `${application.company.name} · ${application.role} — ${promptText.slice(0, 40)}`,
        },
      });

      send({ type: "progress", message: "✍️ 경험과 회사 분석을 엮는 중..." });
      // (초안 안에서 AI 티 검증 → 교정 → 길이 맞춤까지 돌고 나온다)

      const { result: draft, usages } = await draftEssay({
        companyName: application.company.name,
        role: application.role,
        prompt: promptText,
        kind,
        maxChars,
        tone,
        experiences: experiences.map((e) => ({
          id: e.id,
          title: e.title,
          period: e.period,
          role: e.role,
          situation: e.situation,
          action: e.action,
          impact: e.impact,
          learning: e.learning,
          message: e.message,
          tags: e.tags,
        })),
        company: application.company.analysis as CompanyAnalysis | null,
        roleAnalysis: application.roleAnalysis as RoleAnalysis | null,
      });

      // 실행 기록 (비용 집계)
      const now = new Date();
      for (const usage of usages) {
        const log = await prisma.agentLog.create({
          data: {
            resultId: result.id,
            stage: "essay",
            persona: "recruiter",
            status: "success",
            output: { chars: countChars(draft.content) } as Prisma.InputJsonValue,
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

      send({ type: "progress", message: "📋 책상에 저장하는 중..." });

      // ── 자동 저장 ──
      // 이미 있는 문항이면 이전 답변을 history로 밀어 넣고 새 답변을 얹는다.
      const charCount = countChars(draft.content);
      const questions = draft.questions as unknown as Prisma.InputJsonValue;

      let essay;
      if (essayId) {
        const prev = await prisma.essay.findUnique({ where: { id: essayId } });
        const history =
          prev && prev.content
            ? [
                ...(prev.history as Prisma.InputJsonValue[]),
                { content: prev.content, charCount: prev.charCount, at: prev.updatedAt },
              ].slice(-5) // 최근 5개까지만
            : ((prev?.history ?? []) as Prisma.InputJsonValue[]);

        essay = await prisma.essay.update({
          where: { id: essayId },
          data: {
            prompt: promptText,
            kind,
            maxChars: maxChars ?? null,
            content: draft.content,
            charCount,
            questions,
            usedExpIds: experiences.map((e) => e.id),
            resultId: result.id,
            history: history as Prisma.InputJsonValue[],
          },
        });
      } else {
        const count = await prisma.essay.count({ where: { applicationId } });
        essay = await prisma.essay.create({
          data: {
            applicationId,
            order: count,
            prompt: promptText,
            kind,
            maxChars: maxChars ?? null,
            content: draft.content,
            charCount,
            questions,
            usedExpIds: experiences.map((e) => e.id),
            resultId: result.id,
          },
        });
      }

      await prisma.result.update({
        where: { id: result.id },
        data: { resultData: { essayId: essay.id } as Prisma.InputJsonValue },
      });

      send({
        type: "complete",
        essay: {
          id: essay.id,
          prompt: essay.prompt,
          kind: essay.kind,
          maxChars: essay.maxChars,
          content: essay.content,
          charCount: essay.charCount,
          questions: draft.questions,
        },
        opening: draft.opening,
      });
    },
    { label: "자소서 초안", errorMessage: "초안 작성에 실패했습니다." }
  );
}
