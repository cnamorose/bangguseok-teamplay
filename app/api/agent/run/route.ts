import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSearch } from "@/lib/agents/search";
import { runGenerate } from "@/lib/agents/generate";
import { runOrganize } from "@/lib/agents/organize";
import { runVisualize } from "@/lib/agents/visualize";
import { runCritic } from "@/lib/agents/critic";
import { createDocument, saveToPublic } from "@/lib/documents";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { topic, searchPersona, generatePersona, organizePersona, visualizePersona, organizeStyle, criticCount } =
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

      // 프론트에 이벤트 하나 보내는 헬퍼
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // assembly + result 생성
        const assembly = await prisma.assembly.create({
          data: {
            userId: user.id,
            name: `${topic} 팀`,
            searchPersona, generatePersona, organizePersona, visualizePersona,
          },
        });
        const result = await prisma.result.create({
          data: { assemblyId: assembly.id, userId: user.id, topic },
        });

        // 단계 실행 + agent_log 저장 + 진행상황 전송 헬퍼
        async function runStage<T>(
          stage: string,
          persona: string,
          message: string,
          fn: () => Promise<{ output: T; usage: import("@/lib/ai").LLMUsage | null }>
        ): Promise<T> {
          send({ type: "progress", stage, message });
          const startedAt = new Date();
          const { output, usage } = await fn();
          const completedAt = new Date();

          const log = await prisma.agentLog.create({
            data: {
              resultId: result.id, stage, persona, status: "success",
              output: output as unknown as Prisma.InputJsonValue,
              startedAt, completedAt,
            },
          });

          // 진짜 토큰/비용 저장
          await prisma.apiUsage.create({
            data: {
              agentLogId: log.id,
              provider: "openai",
              tokensIn: usage?.inputTokens ?? 0,
              tokensOut: usage?.outputTokens ?? 0,
              cost: usage?.cost ?? 0,
            },
          });

          send({ type: "done", stage });
          return output;
        }

        const search = await runStage("search", searchPersona, "🔍 서치 모듈이 열심히 검색중이다...", () =>
          runSearch(topic, searchPersona)
        );
        let generate = await runStage("generate", generatePersona, "📝 이제 작성을 해볼까?", () =>
          runGenerate(topic, generatePersona, search)
        );
        // 비평가 루프 (criticCount만큼, 통과하면 조기 종료)
        const critics = criticCount || 0;
        for (let round = 1; round <= critics; round++) {
          send({ type: "progress", stage: "critic", message: `🎯 비평가 ${round}번이 초안을 살펴보는 중...` });
          const startedAt = new Date();
          const { output: critique, usage: criticUsage } = await runCritic(generate, round);
          const completedAt = new Date();

          const criticLog = await prisma.agentLog.create({
            data: {
              resultId: result.id, stage: "critic", persona: `critic-${round}`,
              status: "success",
              output: critique as unknown as Prisma.InputJsonValue,
              startedAt, completedAt,
            },
          });
          await prisma.apiUsage.create({
            data: {
              agentLogId: criticLog.id, provider: "openai",
              tokensIn: criticUsage.inputTokens,
              tokensOut: criticUsage.outputTokens,
              cost: criticUsage.cost,
            },
          });

          send({ type: "critic_comment", round, comment: critique.comment, pass: critique.pass });

          if (critique.pass) {
            send({ type: "progress", stage: "critic", message: `✅ 비평가 ${round}번: 통과!` });
            break;
          }

          generate = await runStage("generate", generatePersona, `✍️ 피드백 받고 다시 쓰는 중... (${round}차 수정)`, () =>
            runGenerate(topic, generatePersona, search, {
              previousDraft: generate,
              feedback: critique.feedback,
            })
          );
        }

        // 정리 (루프 끝난 최종 초안을 다듬음)
        const organize = await runStage("organize", organizePersona, "✨ 좋아! 정리해보자!", () =>
          runOrganize(organizePersona, generate, organizeStyle)
        );
        const visualize = await runStage("visualize", visualizePersona, "📊 괜찮은 초안을 만들자", () =>
          runVisualize(visualizePersona, organize)
        );

        // 파일 생성
        send({ type: "progress", stage: "file", message: "📦 결과물을 만드는 중..." });
        const { buffer, ext } = await createDocument(visualize);
        const filePath = await saveToPublic(buffer, `${result.id}.${ext}`);

        const finalData = { search, generate, organize, visualize };
        await prisma.result.update({
          where: { id: result.id },
          data: {
            resultData: finalData as unknown as Prisma.InputJsonValue,
            filePath,
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