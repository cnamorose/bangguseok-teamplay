import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runDynamicGeneration } from "@/lib/agents/orchestrator";
import { LLMUsage } from "@/lib/ai";
import { Prisma } from "@prisma/client";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { sseStream } from "@/lib/sse";
import { isShelfColor } from "@/lib/shelf-color";

// 파이프라인이 길어 시간이 걸리므로 함수 실행 시간을 늘린다
export const maxDuration = 60;

// LLM 호출이 가장 많은 파이프라인 → 유저당 10분에 5회
// (IP는 위조 가능하므로 로그인 유저 id 기준으로 제한)
const RUN_LIMIT = 5;
const RUN_WINDOW_MS = 10 * 60 * 1000;

// 입력 상한 (토큰 비용 폭주 방지)
const MAX_TOPIC_LEN = 200;
const MAX_DETAIL_LEN = 2000;
const MAX_TEAM_NAME_LEN = 100;
const MAX_CRITIC_ROUNDS = 5;
const MAX_TARGET_LENGTH = 20000;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rl = rateLimit(`run:${user.id}`, RUN_LIMIT, RUN_WINDOW_MS);
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

  const { topic: rawTopic, detail, teamName, searchPersona, generatePersona, organizePersona, visualizePersona, organizeStyle, criticCount, targetLength, color } =
    await req.json();

  if (!rawTopic || !searchPersona || !generatePersona || !organizePersona || !visualizePersona) {
    return new Response(JSON.stringify({ error: "topic과 4단계 페르소나가 모두 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const topic = String(rawTopic).trim().slice(0, MAX_TOPIC_LEN);
  if (!topic) {
    return new Response(JSON.stringify({ error: "주제를 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return sseStream(
    async (send) => {
      // assembly + result 생성
      const assembly = await prisma.assembly.create({
        data: {
          userId: user.id,
          name:
            typeof teamName === "string" && teamName.trim()
              ? teamName.trim().slice(0, MAX_TEAM_NAME_LEN)
              : `${topic} 팀`,
          searchPersona, generatePersona, organizePersona, visualizePersona,
        },
      });
      const result = await prisma.result.create({
        data: {
          assemblyId: assembly.id,
          userId: user.id,
          topic,
          // 안 골랐으면 null — 책장에서 id로 색을 뽑는다
          color: isShelfColor(color) ? color : null,
        },
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
      const detailText = typeof detail === "string" ? detail.trim().slice(0, MAX_DETAIL_LEN) : "";
      const topicForGen = detailText
        ? `${topic}\n\n[글쓴이의 세부 요청 — 초점·관점·톤] ${detailText}`
        : topic;

      // 클라이언트 값은 신뢰하지 않고 서버에서 상한을 강제한다
      const rounds = Math.min(Math.max(Number(criticCount) || 0, 0), MAX_CRITIC_ROUNDS);
      const target = Number(targetLength) > 0
        ? Math.min(Number(targetLength), MAX_TARGET_LENGTH)
        : undefined;

      // 편집장(지휘자) 주도 다이나믹 생성
      const finalData = await runDynamicGeneration(
        topicForGen,
        { searchPersona, generatePersona, organizePersona, visualizePersona },
        {
          maxRounds: rounds,
          organizeStyle,
          maxResearch: 2,
          maxRewrite: 2,
          targetLength: target,
        },
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
    },
    { label: "파이프라인", errorMessage: "실행에 실패했습니다." }
  );
}
