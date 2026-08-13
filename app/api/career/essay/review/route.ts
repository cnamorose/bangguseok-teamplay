import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { sseStream } from "@/lib/sse";
import { LLMUsage } from "@/lib/ai";
import { EvaluationResult } from "@/lib/pipeline-types";
import {
  ReviewInput,
  collectPoints,
  reviewChief,
  reviewExperience,
  reviewPrompt,
  reviewStyle,
  reviseEssay,
} from "@/lib/agents/essay/review";
import { guessKind } from "@/lib/agents/essay/kinds";

// 채점 4회 + 종합 1회 + 수정본 1회
export const maxDuration = 60;

const REVIEW_LIMIT = 10;
const REVIEW_WINDOW_MS = 10 * 60 * 1000;

const MAX_TEXT_LEN = 20000;
const MAX_PROMPT_LEN = 500;

/** 첨삭할 수 있는 문항 목록 (내용이 있는 것만) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const essays = await prisma.essay.findMany({
    where: { application: { userId: user.id }, NOT: { content: "" } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      prompt: true,
      kind: true,
      charCount: true,
      content: true,
      application: { select: { role: true, company: { select: { name: true } } } },
    },
  });

  return Response.json({ essays }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rl = rateLimit(`review:${user.id}`, REVIEW_LIMIT, REVIEW_WINDOW_MS);
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

  const body = await req.json();
  // 저장된 문항을 첨삭하거나(essayId), 그냥 붙여넣은 글을 첨삭한다
  const essayId = body.essayId ? String(body.essayId) : null;
  const userOpinion =
    typeof body.userOpinion === "string" ? body.userOpinion.slice(0, 2000) : undefined;

  let input: ReviewInput;

  if (essayId) {
    const essay = await prisma.essay.findUnique({
      where: { id: essayId },
      include: { application: { include: { company: true } } },
    });
    if (!essay || essay.application.userId !== user.id) {
      return new Response(JSON.stringify({ error: "문항을 찾을 수 없습니다." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!essay.content.trim()) {
      return new Response(JSON.stringify({ error: "아직 작성된 내용이 없어요." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    input = {
      companyName: essay.application.company.name,
      role: essay.application.role,
      prompt: essay.prompt,
      kind: essay.kind,
      maxChars: essay.maxChars,
      text: essay.content,
      experiences: [],
    };
  } else {
    const text = String(body.text ?? "").trim().slice(0, MAX_TEXT_LEN);
    const promptText = String(body.prompt ?? "").trim().slice(0, MAX_PROMPT_LEN);

    if (!text || !promptText) {
      return new Response(JSON.stringify({ error: "문항과 자소서 내용이 필요합니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    input = {
      companyName: String(body.companyName ?? "").trim().slice(0, 60) || "지원 회사",
      role: String(body.role ?? "").trim().slice(0, 60) || "지원 직무",
      prompt: promptText,
      kind: typeof body.kind === "string" && body.kind ? body.kind : guessKind(promptText),
      maxChars: Number(body.maxChars) > 0 ? Number(body.maxChars) : null,
      text,
      experiences: [],
    };
  }

  // 경험 대조관이 쓸 재료. 저장된 문항이면 그 문항에 쓴 경험을, 아니면 전체를 본다.
  const usedIds: string[] = essayId
    ? ((await prisma.essay.findUnique({ where: { id: essayId }, select: { usedExpIds: true } }))
        ?.usedExpIds ?? [])
    : [];

  const experiences = await prisma.experience.findMany({
    where: usedIds.length > 0
      ? { id: { in: usedIds }, userId: user.id }
      : { userId: user.id },
    orderBy: [{ starred: "desc" }, { updatedAt: "desc" }],
    take: 10,
  });

  input.experiences = experiences.map((e) => ({
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
  }));

  return sseStream(
    async (send) => {
      const result = await prisma.result.create({
        data: {
          userId: user.id,
          mode: "career",
          kind: "review",
          topic: `${input.companyName} · ${input.prompt.slice(0, 40)}`,
        },
      });

      const usages: LLMUsage[] = [];
      const results: EvaluationResult[] = [];

      const step = async (
        message: string,
        fn: () => Promise<{ result: EvaluationResult; usage: LLMUsage }>
      ) => {
        send({ type: "progress", message });
        const r = await fn();
        usages.push(r.usage);
        results.push(r.result);
        send({ type: "evaluation", result: r.result });
      };

      await step("👔 인사담당관이 전체를 보는 중...", () => reviewChief(input));
      await step("📌 문항 지킴이가 문항과 맞춰보는 중...", () => reviewPrompt(input));
      await step("🧰 경험 대조관이 등록된 경험과 대조하는 중...", () => reviewExperience(input));
      await step("✍️ 문장 검수관이 AI 자국을 찾는 중...", () => reviewStyle(input));

      send({ type: "progress", message: "📋 고칠 곳을 정리하는 중..." });
      const { points, usage: pointUsage } = await collectPoints(input, results);
      usages.push(pointUsage);
      send({ type: "points", points });

      send({ type: "progress", message: "✨ 첨삭을 반영한 수정본을 만드는 중..." });
      const { revised, usages: reviseUsages } = await reviseEssay(input, points, userOpinion);
      usages.push(...reviseUsages);

      // 비용 기록
      const now = new Date();
      for (const usage of usages) {
        const log = await prisma.agentLog.create({
          data: {
            resultId: result.id,
            stage: "review",
            persona: "reviewer",
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

      // 첨삭 기록 저장 — 공부방 평가와 같은 표를 쓴다
      const evaluation = await prisma.evaluation.create({
        data: {
          userId: user.id,
          mode: "career",
          topic: `${input.companyName} · ${input.role} — ${input.prompt.slice(0, 60)}`,
          text: input.text,
          results: results as unknown as Prisma.InputJsonValue,
          revised: revised || null,
          targetType: essayId ? "essay" : null,
          targetId: essayId,
        },
        select: { id: true },
      });

      await prisma.result.update({
        where: { id: result.id },
        data: { resultData: { evaluationId: evaluation.id } as Prisma.InputJsonValue },
      });

      if (revised) send({ type: "revision", revised });
      send({ type: "complete", evaluationId: evaluation.id });
    },
    { label: "자소서 첨삭", errorMessage: "첨삭에 실패했습니다." }
  );
}
