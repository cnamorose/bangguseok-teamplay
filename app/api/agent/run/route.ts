import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/ai";
import { GENERATE_PERSONAS } from "@/lib/personas";

export async function POST(req: NextRequest) {
  try {
    // 1. 로그인 유저 확인 (필수)
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { topic, generatePersona } = await req.json();

    // 2. 입력 검증
    if (!topic || !generatePersona) {
      return NextResponse.json(
        { error: "topic과 generatePersona는 필수입니다." },
        { status: 400 }
      );
    }

    const persona = GENERATE_PERSONAS[generatePersona];
    if (!persona) {
      return NextResponse.json(
        { error: `알 수 없는 페르소나: ${generatePersona}` },
        { status: 400 }
      );
    }

    // 3. 임시 assembly 생성
    //    (지금은 생성 단계만 있으니 나머지 페르소나는 임시값.
    //     나중에 조합 화면 생기면 실제 선택값으로 대체)
    const assembly = await prisma.assembly.create({
      data: {
        userId: user.id,
        name: `${topic} 팀`,
        searchPersona: "none",
        generatePersona: persona.id,
        organizePersona: "none",
        visualizePersona: "none",
      },
    });

    // 4. result 생성 (실행 기록의 뿌리)
    const result = await prisma.result.create({
      data: {
        assemblyId: assembly.id,
        userId: user.id,
        topic,
      },
    });

    // 5. 생성 단계 실행 + agent_log에 기록
    const startedAt = new Date();

    const content = await callLLM({
      systemPrompt: persona.systemPrompt,
      userPrompt: `다음 주제로 글을 작성해줘: ${topic}`,
    });

    const completedAt = new Date();

    const agentLog = await prisma.agentLog.create({
      data: {
        resultId: result.id,
        stage: "generate",
        persona: persona.id,
        status: "success",
        output: { content },
        startedAt,
        completedAt,
      },
    });

    // 6. api_usage 기록
    //    (Gemini SDK가 토큰 수를 주기도 하지만, 지금은 단순화해서 기록만.
    //     비용/토큰 정밀 계산은 나중에 붙임)
    await prisma.apiUsage.create({
      data: {
        agentLogId: agentLog.id,
        provider: "google-gemini",
        cost: 0,
      },
    });

    // 7. 응답
    return NextResponse.json(
      {
        message: "실행 완료",
        resultId: result.id,
        topic,
        persona: persona.name,
        content,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("실행 에러:", error);
    return NextResponse.json(
      { error: "실행에 실패했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}