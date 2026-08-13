// 답변이 답변인지 코드로 먼저 가린다.
//
// LLM에게 "칭찬하지 마라"고 시켜도, 무의미한 입력에까지 "간결하게 답하려 한 점이 좋다"
// 같은 말을 만들어낸다. 한 번이라도 그러면 나머지 피드백까지 못 믿게 되므로,
// 애초에 LLM에게 넘기기 전에 걸러낸다.

/** 완성형 한글 · 영문 · 숫자 (뜻을 담을 수 있는 글자) */
const MEANINGFUL = /[가-힣a-zA-Z0-9]/g;

export interface AnswerCheck {
  ok: boolean;
  /** 왜 답변으로 못 보는지 (화면·프롬프트에 그대로 쓴다) */
  reason?: string;
}

export function checkAnswer(text: string): AnswerCheck {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "빈 답변" };

  const chars = Array.from(trimmed.replace(/\s/g, ""));
  const meaningful = trimmed.match(MEANINGFUL)?.length ?? 0;

  // ㄴㅇㄹ, ㅋㅋㅋ 처럼 자모나 기호만 두드린 경우
  if (meaningful < 3) {
    return { ok: false, reason: "글자가 아니라 자판을 두드린 입력" };
  }
  if (chars.length > 0 && meaningful / chars.length < 0.3) {
    return { ok: false, reason: "뜻을 알 수 없는 문자가 대부분" };
  }
  // aaaa, ㅁㅁㅁㅁ 처럼 같은 글자 반복
  if (new Set(chars).size < 3) {
    return { ok: false, reason: "같은 글자만 반복" };
  }

  return { ok: true };
}
