import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/ai";
import { GENERATE_PERSONAS } from "@/lib/personas";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";

// LLM 1회짜리 라우트 → 유저당 10분에 30회
const GENERATE_LIMIT = 30;
const GENERATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TOPIC_LEN = 500;

export async function POST(req: NextRequest) {
  try {
    // 로그인한 사용자만 호출 가능 (LLM 비용 남용 방지)
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const rl = rateLimit(`generate:${user.id}`, GENERATE_LIMIT, GENERATE_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

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
      userPrompt: `다음 주제로 글을 작성해줘: ${String(topic).slice(0, MAX_TOPIC_LEN)}`,
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
    // 에러 상세는 서버 로그에만 남긴다 (응답에 담으면 내부 정보가 노출됨)
    console.error("생성 모듈 에러:", error);
    return NextResponse.json(
      { error: "생성에 실패했습니다." },
      { status: 500 }
    );
  }
}