// 서버-보내기-이벤트(SSE) 응답 골격.
//
// 파이프라인이 긴 라우트들은 진행 상황을 조금씩 흘려보내야 해서 스트림으로 응답한다.
// 스트림을 만들고 "data: {...}\n\n" 형식으로 감싸고 에러를 잡아 닫는 부분은
// 라우트마다 똑같으므로 여기로 모았다. 라우트는 send()로 보낼 것만 신경 쓰면 된다.

/** 이벤트 한 건을 클라이언트로 흘려보낸다 */
export type SseSend = (data: object) => void;

export interface SseOptions {
  /** 서버 로그에 남길 이름 (예: "파이프라인") */
  label: string;
  /** 실패 시 클라이언트에 보낼 메시지. 내부 에러 상세는 로그에만 남긴다 */
  errorMessage: string;
}

export function sseStream(
  run: (send: SseSend) => Promise<void>,
  { label, errorMessage }: SseOptions
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send: SseSend = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await run(send);
      } catch (error) {
        console.error(`${label} 에러:`, error);
        send({ type: "error", message: errorMessage });
      } finally {
        // 성공이든 실패든 여기서만 닫는다 (닫기를 빠뜨리면 클라이언트가 계속 기다린다)
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
