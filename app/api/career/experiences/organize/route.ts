import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { organizeExperience } from "@/lib/agents/experience/organize";

// LLM 1회짜리라 스트림 없이 한 번에 응답한다
export const maxDuration = 30;

const ORGANIZE_LIMIT = 30;
const ORGANIZE_WINDOW_MS = 10 * 60 * 1000;
const MAX_RAW_LEN = 5000;

/** 막 적은 글 → 항목별 정리 + 키워드 + 부족한 점 (저장은 하지 않는다) */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rl = rateLimit(`exp-organize:${user.id}`, ORGANIZE_LIMIT, ORGANIZE_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const { raw } = await req.json();
    const text = String(raw ?? "").trim().slice(0, MAX_RAW_LEN);

    if (text.length < 10) {
      return NextResponse.json(
        { error: "조금만 더 적어주세요. 한두 문장이면 충분해요." },
        { status: 400 }
      );
    }

    const { data } = await organizeExperience(text);
    return NextResponse.json({ organized: data }, { status: 200 });
  } catch (error) {
    console.error("경험 정리 에러:", error);
    return NextResponse.json({ error: "정리에 실패했습니다." }, { status: 500 });
  }
}
