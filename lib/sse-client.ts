// 브라우저에서 SSE 응답을 읽는 쪽.
// (보내는 쪽은 lib/sse.ts)
//
// 스트림은 아무 데서나 잘려서 도착한다. "data: {...}\n\n" 한 덩어리가
// 두 번에 나뉘어 올 수도 있어서, 남은 조각을 버퍼에 들고 있다가 다음 조각과 이어 붙여야 한다.
// 이 처리를 화면마다 반복하면 한 곳만 어긋나도 이벤트가 조용히 사라지므로 여기로 모았다.

/**
 * 서버가 보내는 이벤트. type으로 갈라 쓰고, 나머지 필드는 type마다 다르다.
 * 특정 화면에서 형태를 좁히고 싶으면 readSse<MyEvent>(...)로 넘기면 된다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SseEvent { type: string; [key: string]: any }

/**
 * 응답 스트림을 끝까지 읽으면서 이벤트가 도착할 때마다 onEvent를 부른다.
 * 스트림이 닫히면 반환된다.
 */
export async function readSse<T extends SseEvent = SseEvent>(
  res: Response,
  onEvent: (event: T) => void
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // "data: {...}\n\n" 단위로 자르고, 마지막 미완성 조각은 버퍼에 남긴다
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      if (!chunk.startsWith("data: ")) continue;
      onEvent(JSON.parse(chunk.slice(6)) as T);
    }
  }
}
