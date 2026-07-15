import { NextResponse } from "next/server";
import { callLLM } from "@/lib/ai";

export async function GET() {
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