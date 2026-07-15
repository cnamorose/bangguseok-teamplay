import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/ai";
import { GENERATE_PERSONAS } from "@/lib/personas";

export async function POST(req: NextRequest) {
  try {
    const { topic, persona } = await req.json();

    // 1. 입력 검증
    if (!topic || !persona) {
      return NextResponse.json(
        { error: "topic과 persona는 필수입니다." },
        { status: 400 }
      );
    }

    // 2. 페르소나 유효성 확인
    const selectedPersona = GENERATE_PERSONAS[persona];
    if (!selectedPersona) {
      return NextResponse.json(
        { error: `알 수 없는 페르소나입니다: ${persona}` },
        { status: 400 }
      );
    }

    // 3. 공용 함수로 LLM 호출
    const content = await callLLM({
      systemPrompt: selectedPersona.systemPrompt,
      userPrompt: `다음 주제로 글을 작성해줘: ${topic}`,
    });

    // 4. 결과 반환
    return NextResponse.json(
      {
        stage: "generate",
        persona: selectedPersona.id,
        personaName: selectedPersona.name,
        content,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("생성 모듈 에러:", error);
    return NextResponse.json(
      { error: "생성에 실패했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}