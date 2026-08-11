import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractText, deriveTopic, ParseDocError } from "@/lib/parse-doc";
import { callLLMJson } from "@/lib/ai";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// 파싱(CPU) + LLM 1회 → 유저당 10분에 20회
const PARSE_LIMIT = 20;
const PARSE_WINDOW_MS = 10 * 60 * 1000;

// 파싱 + 주제 파악(LLM)까지 여유를 준다
export const maxDuration = 60;

/**
 * LLM으로 글의 주제를 한 줄로 뽑는다.
 * 실패하면 휴리스틱(첫 줄/파일명)으로 폴백.
 */
async function detectTopic(filename: string, text: string): Promise<string> {
  try {
    // 주제 파악엔 앞부분이면 충분 (비용 절약)
    const excerpt = text.slice(0, 2000);

    const { data } = await callLLMJson<{ topic: string }>({
      systemPrompt: "너는 글을 읽고 주제를 한 줄로 요약하는 전문가야.",
      userPrompt: `
아래 글의 주제를 30자 이내의 명사구 하나로 정리해줘.
"~에 대한 글" 같은 군더더기 없이 주제 자체만.

[글]
${excerpt}

아래 JSON 형식으로만 응답해.
{ "topic": "주제 (30자 이내)" }
`.trim(),
    });

    const topic = data.topic?.trim();
    if (topic) return topic.slice(0, 60);
  } catch (error) {
    console.warn("주제 파악 실패, 휴리스틱으로 폴백:", error);
  }
  return deriveTopic(filename, text);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rl = rateLimit(`parse-file:${user.id}`, PARSE_LIMIT, PARSE_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "파일이 너무 커요. (최대 10MB)" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractText(file.name, buf);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "문서에서 글을 찾지 못했어요. 내용을 확인해주세요." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { topic: await detectTopic(file.name, text), text },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ParseDocError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("파일 파싱 에러:", error);
    return NextResponse.json({ error: "파일을 읽지 못했습니다." }, { status: 500 });
  }
}
