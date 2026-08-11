import { NextResponse } from "next/server";
import { callLLM } from "@/lib/ai";

export async function GET() {
  // 인증 없이 LLM을 호출하는 개발용 테스트 엔드포인트.
  // 운영 환경에서는 비용 남용을 막기 위해 아예 노출하지 않는다.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const reply = await callLLM({ userPrompt: "안녕? 한 문장으로 자기소개 해줘." });
    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "AI 호출 실패", detail: String(error) },
      { status: 500 }
    );
  }
}