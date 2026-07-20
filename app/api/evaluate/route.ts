import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { evaluateChief, evaluateSearch, evaluateOrganize } from "@/lib/agents/evaluator";

// 평가단 3명 호출이 길어질 수 있어 실행 시간을 늘린다
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { topic, text } = await req.json();

  if (!topic || !text) {
    return new Response(JSON.stringify({ error: "주제와 글이 모두 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const evaluations = [];

        // 평가원 (종합)
        send({ type: "progress", message: "📋 평가원이 전체를 살펴보는 중..." });
        const chief = await evaluateChief(text);
        evaluations.push(chief.result);
        send({ type: "evaluation", result: chief.result });

        // 인간 도서관 (사실성 - 실제 검색)
        send({ type: "progress", message: "📚 인간 도서관이 사실을 검색하는 중..." });
        const search = await evaluateSearch(text, topic);
        evaluations.push(search.result);
        send({ type: "evaluation", result: search.result });

        // 글조합 천재 (정교함)
        send({ type: "progress", message: "✍️ 글조합 천재가 문장을 뜯어보는 중..." });
        const organize = await evaluateOrganize(text);
        evaluations.push(organize.result);
        send({ type: "evaluation", result: organize.result });

        // 저장은 사용자가 "클립보드에 저장"을 눌렀을 때만 (/api/evaluate/save)
        send({ type: "complete", evaluations });
        controller.close();
      } catch (error) {
        console.error("평가 에러:", error);
        send({ type: "error", message: "평가에 실패했습니다." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}