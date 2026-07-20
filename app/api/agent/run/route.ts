import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runDynamicGeneration } from "@/lib/agents/orchestrator";
import { LLMUsage } from "@/lib/ai";
import { Prisma } from "@prisma/client";

// 파이프라인이 길어 시간이 걸리므로 함수 실행 시간을 늘린다
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { topic, detail, teamName, searchPersona, generatePersona, organizePersona, visualizePersona, organizeStyle, criticCount } =
    await req.json();

  if (!topic || !searchPersona || !generatePersona || !organizePersona || !visualizePersona) {
    return new Response(JSON.stringify({ error: "topic과 4단계 페르소나가 모두 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SSE 스트림 생성
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // assembly + result 생성
        const assembly = await prisma.assembly.create({
          data: {
            userId: user.id,
            name: typeof teamName === "string" && teamName.trim() ? teamName.trim() : `${topic} 팀`,
            searchPersona, generatePersona, organizePersona, visualizePersona,
          },
        });
        const result = await prisma.result.create({
          data: { assemblyId: assembly.id, userId: user.id, topic },
        });

        // 오케스트레이터가 각 단계 결과를 저장할 콜백
        const persist = async (
          stage: string,
          persona: string,
          output: unknown,
          usage: LLMUsage | null,
          countProgress: boolean
        ) => {
          const now = new Date();
          const log = await prisma.agentLog.create({
            data: {
              resultId: result.id, stage, persona, status: "success",
              output: output as Prisma.InputJsonValue,
              startedAt: now, completedAt: now,
            },
          });
          await prisma.apiUsage.create({
            data: {
              agentLogId: log.id,
              provider: "openai",
              tokensIn: usage?.inputTokens ?? 0,
              tokensOut: usage?.outputTokens ?? 0,
              cost: usage?.cost ?? 0,
            },
          });
          if (countProgress) send({ type: "done", stage });
        };

        // 저장된 topic은 깨끗하게 두고, 생성 단계에만 사용자의 세부 요청(초점·관점·톤)을 덧붙인다.
        const detailText = typeof detail === "string" ? detail.trim() : "";
        const topicForGen = detailText
          ? `${topic}\n\n[글쓴이의 세부 요청 — 초점·관점·톤] ${detailText}`
          : topic;

        // 편집장(지휘자) 주도 다이나믹 생성
        const finalData = await runDynamicGeneration(
          topicForGen,
          { searchPersona, generatePersona, organizePersona, visualizePersona },
          { maxRounds: criticCount || 0, organizeStyle, maxResearch: 2, maxRewrite: 2 },
          {
            progress: (message, stage) => send({ type: "progress", stage, message }),
            persist,
          }
        );

        // 결과물은 다운로드 누를 때 즉석 생성한다 (서버리스는 디스크에 못 저장)
        send({ type: "progress", stage: "file", message: "📦 결과물을 준비하는 중..." });

        await prisma.result.update({
          where: { id: result.id },
          data: {
            resultData: finalData as unknown as Prisma.InputJsonValue,
            filePath: `/api/result/${result.id}/download`,
          },
        });

        // 최종 완료 (resultId 전달 → 프론트가 결과 페이지로 이동)
        send({ type: "complete", resultId: result.id });
        controller.close();
      } catch (error) {
        console.error("파이프라인 에러:", error);
        send({ type: "error", message: "실행에 실패했습니다." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
