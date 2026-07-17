import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  decideNextSpeaker,
  generateSpeech,
  generateSummary,
  generateRevision,  
  DiscussionMessage,
} from "@/lib/agents/discussion";

// 회의(여러 발언 + 중복검사 + 수정본)가 길어서 실행 시간을 늘린다
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text, librarianTurns, wordsmithTurns } = await req.json();

  if (!text) {
    return new Response(JSON.stringify({ error: "평가할 글이 필요합니다." }), {
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
        const history: DiscussionMessage[] = [];
        const remaining = {
          librarian: librarianTurns || 0,
          wordsmith: wordsmithTurns || 0,
        };

        // 안전장치: 발언권 총합 + 평가원 여유분만큼만 (무한 방지)
        const maxTurns = remaining.librarian + remaining.wordsmith + 4;
        let turnCount = 0;

        // 빈 발언은 화면에 안 띄우고 히스토리에도 안 넣는다
        const emit = (m: DiscussionMessage): boolean => {
          if (!m.message.trim()) return false;
          history.push(m);
          send({ type: "message", message: m });
          return true;
        };

        // 평가원이 대화를 연다
        send({ type: "progress", message: "🎬 평가원이 회의를 시작합니다..." });
        const opening = await generateSpeech("chief", text, history);
        emit(opening.message);

        // 대화 루프
        while (turnCount < maxTurns) {
          turnCount++;

          // 다음 발언자 결정
          const decision = await decideNextSpeaker(text, history, remaining);

          if (decision.next === "end") break;

          if (decision.next === "chief") {
            // 평가원이 직접 반응
            const speech = await generateSpeech("chief", text, history);
            emit(speech.message);
          } else {
            // 도서관 or 천재 발언 (내용이 있을 때만 발언권 차감)
            const speech = await generateSpeech(decision.next, text, history);
            if (emit(speech.message)) remaining[decision.next]--;
          }

          // 도서관·천재 발언권 모두 소진되면 종료
          if (remaining.librarian <= 0 && remaining.wordsmith <= 0) break;
        }

        // 평가원 종합 정리
        send({ type: "progress", message: "📝 평가원이 논의를 종합하는 중..." });
        const summary = await generateSummary(text, history);
        emit(summary.message);

        // 논의를 취합한 수정본 생성 (내용이 있을 때만 전송)
        send({ type: "progress", message: "✨ 논의를 반영한 수정본을 만드는 중..." });
        const revision = await generateRevision(text, history);
        if (revision.revised.trim()) {
          send({ type: "revision", revised: revision.revised });
        }

        send({ type: "complete" });
        controller.close();
      } catch (error) {
        console.error("논의 에러:", error);
        send({ type: "error", message: "논의 진행에 실패했습니다." });
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