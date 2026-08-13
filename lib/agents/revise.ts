import { callLLMJson, LLMUsage } from "@/lib/ai";
import { countChars, fitToLength, lengthInstruction, trimToSentenceEnd } from "./length";

// 지적을 반영한 수정본 만들기.
//
// 공부방(평가단 회의 → 수정본)과 취업방(첨삭 → 수정본)이 같이 쓴다.
// "원본 + 지적사항 + 사용자 의견 → 고친 글, 그리고 길이 맞추기"라는 절차가 같고,
// 다른 건 누가 지적했느냐(systemPrompt)와 어떤 규칙을 더 지킬지(extraRules)뿐이다.

export interface ReviseInput {
  original: string;
  /** 반영할 지적들. 회의 발언이든 첨삭 포인트든 줄글로 넘긴다 */
  points: string;
  /** 글쓴이가 직접 남긴 요구 — 지적보다 우선한다 */
  userOpinion?: string;
  /** 목표 글자수 (공백 포함). 주면 ±50자로 맞춘다 */
  targetLength?: number;
  systemPrompt: string;
  /** 이 도메인에서만 지킬 규칙 (자소서의 쉼표 규칙 등) */
  extraRules?: string;
  /** 지적 목록의 이름 — 프롬프트에 그대로 쓰인다 */
  pointsLabel?: string;
}

export async function reviseText(
  input: ReviseInput
): Promise<{ revised: string; usages: LLMUsage[] }> {
  const usages: LLMUsage[] = [];

  const opinionBlock = input.userOpinion?.trim()
    ? `
[글쓴이(사용자)의 요구사항 - 최우선 반영]
${input.userOpinion.trim()}
`
    : "";

  const userPrompt = `
아래는 원본 글과, 이 글에 대해 나온 지적이야.
지적을 최대한 반영해서 원본을 개선한 '수정본'을 작성해줘.

[원본 글]
${input.original}

[${input.pointsLabel ?? "지적 사항"}]
${input.points}
${opinionBlock}
규칙:
- 지적된 문제를 실제로 반영해서 고쳐.${
    opinionBlock
      ? "\n- 위 [글쓴이의 요구사항]은 다른 지적보다 우선해서 반드시 반영해. 충돌하면 글쓴이의 요구를 따라."
      : ""
  }
- 원본의 핵심 주제와 논지는 유지해.
- **원본에 없는 사실·숫자·경험을 새로 만들지 마.** 표현과 구성을 고치는 선에서 해결해.
- 완성된 하나의 글로 작성해. (지적 목록이 아니라 실제 개선된 글)
${input.extraRules ? input.extraRules : ""}

아래 JSON 형식으로만 응답해.
{ "revised": "개선된 글 전문" }
`.trim();

  const { data, usage } = await callLLMJson<{ revised: string }>({
    systemPrompt: input.systemPrompt,
    userPrompt,
  });
  usages.push(usage);

  let revised = (data.revised ?? "").trim();

  // 목표 글자수가 있으면 측정 → 교정 루프로 맞춘다
  if (input.targetLength && input.targetLength > 0 && revised) {
    const target = input.targetLength;
    revised = await fitToLength({
      target,
      tol: 50,
      maxTries: 3,
      initial: revised,
      measure: (s) => countChars(s),
      revise: async (s, cur) => {
        const p = `
아래 글을 '길이만' 목표에 맞게 다시 써줘. 주제·논지·핵심 내용은 유지.

[글]
${s}

${lengthInstruction(cur, target, 50)}
${input.extraRules ?? ""}

아래 JSON 형식으로만 응답해.
{ "revised": "길이를 맞춘 글 전문" }
`.trim();
        const r = await callLLMJson<{ revised: string }>({
          systemPrompt: input.systemPrompt,
          userPrompt: p,
        });
        return { value: r.data.revised || s, usage: r.usage };
      },
      onUsage: (u) => usages.push(u),
    });

    // 그래도 넘치면 문장 끝에서 잘라 상한을 지킨다
    if (countChars(revised) > target + 50) {
      revised = trimToSentenceEnd(revised, target);
    }
  }

  return { revised, usages };
}
