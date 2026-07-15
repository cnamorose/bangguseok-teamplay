import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function GET() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "안녕? 한 문장으로 자기소개 해줘.",
    });

    return NextResponse.json({ reply: response.text }, { status: 200 });
  } catch (error) {
    console.error("AI 테스트 에러:", error);
    return NextResponse.json(
      { error: "AI 호출에 실패했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}