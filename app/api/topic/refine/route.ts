import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLMJson } from "@/lib/ai";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";

// 주제 구체화: 사용자가 던진 큰 틀의 주제를 받아
// 관련 주제 + 더 구체화된 추천 주제를 제안한다. (LLM 1회)
export const maxDuration = 30;

// LLM 1회짜리 가벼운 라우트 → 유저당 10분에 30회
const REFINE_LIMIT = 30;
const REFINE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TOPIC_LEN = 200;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rl = rateLimit(`refine:${user.id}`, REFINE_LIMIT, REFINE_WINDOW_MS);
  if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

  const { topic } = await req.json();
  if (!topic || !String(topic).trim()) {
    return new Response(JSON.stringify({ error: "주제를 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userPrompt = `
사용자가 글쓰기 주제로 "${String(topic).trim().slice(0, MAX_TOPIC_LEN)}"을 입력했어.
이건 큰 틀이라 그대로 쓰기엔 막연해. 글감을 좁혀 주는 제안을 만들어줘.

1) related — 이 주제와 가까운 '인접·하위 주제' 4개. 다른 각도로 넓혀 볼 수 있는 것들.
2) recommended — 이 주제를 더 구체적이고 초점이 분명하게 다듬은 '추천 주제 문구' 4개.
   관점·범위·독자가 드러나게. 그대로 주제칸에 넣어도 될 만큼 완성된 한 줄로.

각 항목은 한 줄, 대략 10~40자. 번호나 기호 붙이지 말고 문구만.

아래 JSON으로만 응답해.
{
  "related": ["...", "...", "...", "..."],
  "recommended": ["...", "...", "...", "..."]
}
`.trim();

  try {
    const { data } = await callLLMJson<{ related: string[]; recommended: string[] }>({
      systemPrompt: "너는 글쓰기 주제를 구체적이고 매력적으로 좁혀 주는 편집 조력자다.",
      userPrompt,
    });

    const clean = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
        : [];

    return new Response(
      JSON.stringify({ related: clean(data.related), recommended: clean(data.recommended) }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("주제 구체화 에러:", error);
    return new Response(JSON.stringify({ error: "주제 구체화에 실패했습니다." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
