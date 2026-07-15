import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSearch } from "@/lib/agents/search";
import { runGenerate } from "@/lib/agents/generate";
import { runOrganize } from "@/lib/agents/organize";
import { runVisualize } from "@/lib/agents/visualize";
import { Prisma } from "@prisma/client";
import { createDocument, saveToPublic } from "@/lib/documents";

export async function POST(req: NextRequest) {
  try {
    // 1. 로그인 확인
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { topic, searchPersona, generatePersona, organizePersona, visualizePersona } =
      await req.json();

    // 2. 입력 검증
    if (!topic || !searchPersona || !generatePersona || !organizePersona || !visualizePersona) {
      return NextResponse.json(
        { error: "topic과 4단계 페르소나가 모두 필요합니다." },
        { status: 400 }
      );
    }

    // 3. assembly 생성 (사용자가 조립한 팀)
    const assembly = await prisma.assembly.create({
      data: {
        userId: user.id,
        name: `${topic} 팀`,
        searchPersona,
        generatePersona,
        organizePersona,
        visualizePersona,
      },
    });

    // 4. result 생성 (실행 기록의 뿌리)
    const result = await prisma.result.create({
      data: { assemblyId: assembly.id, userId: user.id, topic },
    });

    // 각 단계를 실행하고 agent_log에 기록하는 헬퍼
    async function runStage<T>(
      stage: string,
      persona: string,
      fn: () => Promise<T>
    ): Promise<T> {
      const startedAt = new Date();
      const output = await fn();
      const completedAt = new Date();

      const log = await prisma.agentLog.create({
        data: {
          resultId: result.id,
          stage,
          persona,
          status: "success",
          output: output as unknown as Prisma.InputJsonValue,
          startedAt,
          completedAt,
        },
      });

      // api_usage 기록 (지금은 provider만, 비용/토큰은 나중에)
      await prisma.apiUsage.create({
        data: { agentLogId: log.id, provider: "google-gemini", cost: 0 },
      });

      return output;
    }

    // 5. 파이프라인 순차 실행
    const search = await runStage("search", searchPersona, () =>
      runSearch(topic, searchPersona)
    );
    const generate = await runStage("generate", generatePersona, () =>
      runGenerate(topic, generatePersona, search)
    );
    const organize = await runStage("organize", organizePersona, () =>
      runOrganize(organizePersona, generate)
    );
    const visualize = await runStage("visualize", visualizePersona, () =>
      runVisualize(visualizePersona, organize)
    );

    // 6. 시각화 결과로 실제 파일 생성
    const { buffer, ext } = await createDocument(visualize);
    const filename = `${result.id}.${ext}`; // 파일명은 result id로 (충돌 방지)
    const filePath = await saveToPublic(buffer, filename);

    // 7. 최종 결과 + 파일 경로 저장
    const finalData = { search, generate, organize, visualize };
    await prisma.result.update({
      where: { id: result.id },
      data: {
        resultData: finalData as unknown as Prisma.InputJsonValue,
        filePath,
      },
    });

    // 7. 응답
    return NextResponse.json(
      { message: "파이프라인 완료", resultId: result.id, topic, result: finalData },
      { status: 200 }
    );
  } catch (error) {
    console.error("파이프라인 실행 에러:", error);
    return NextResponse.json(
      { error: "실행에 실패했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}