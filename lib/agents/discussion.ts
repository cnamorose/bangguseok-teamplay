import { callLLMJson, callLLM, LLMUsage } from "@/lib/ai";
import { CHIEF_EVALUATOR, SEARCH_EVALUATOR, ORGANIZE_EVALUATOR } from "@/lib/evaluators";
import { EvaluationResult } from "@/lib/pipeline-types";

// 대화 한 발언
export interface DiscussionMessage {
  speakerId: string;
  speakerName: string;
  message: string;
}

// 평가자 id → 정보 매핑
const SPEAKERS: Record<string, { name: string; prompt: string }> = {
  chief: { name: CHIEF_EVALUATOR.name, prompt: CHIEF_EVALUATOR.systemPrompt },
  librarian: { name: SEARCH_EVALUATOR.name, prompt: SEARCH_EVALUATOR.systemPrompt },
  wordsmith: { name: ORGANIZE_EVALUATOR.name, prompt: ORGANIZE_EVALUATOR.systemPrompt },
};

// 지금까지 대화를 텍스트로 정리 (컨텍스트용)
function formatHistory(history: DiscussionMessage[]): string {
  if (history.length === 0) return "(아직 대화 없음)";
  return history.map((m) => `${m.speakerName}: ${m.message}`).join("\n");
}

/**
 * 디렉터(평가원)가 다음 발언자를 결정.
 * 발언권이 남은 평가자 중에서만 고를 수 있음.
 */
export async function decideNextSpeaker(
  text: string,
  history: DiscussionMessage[],
  remaining: { librarian: number; wordsmith: number }
): Promise<{ next: "librarian" | "wordsmith" | "chief" | "end"; usage: LLMUsage }> {
  // 도서관·천재 발언권이 모두 소진되면 무조건 종료
  if (remaining.librarian <= 0 && remaining.wordsmith <= 0) {
    // 디렉터 호출 없이 종료 (비용 절약)
    return { next: "end", usage: { model: "", inputTokens: 0, outputTokens: 0, cost: 0 } };
  }

  const available: string[] = [];
  if (remaining.librarian > 0) available.push("librarian(인간 도서관, 사실성 담당)");
  if (remaining.wordsmith > 0) available.push("wordsmith(글조합 천재, 문장/구성 담당)");

  const userPrompt = `
너는 글 평가 회의의 사회자(평가원)야. 아래 글에 대해 평가자들이 토론 중이야.

[평가 대상 글]
${text}

[지금까지의 대화]
${formatHistory(history)}

[발언 가능한 평가자] (발언권이 남은 사람만)
${available.join(", ")}

다음에 누가 발언하는 게 자연스러운지 결정해. 
- 특정 평가자를 지목하거나 (librarian/wordsmith)
- 네가(사회자, chief) 직접 반응하거나 정리할 수 있어
- 대화가 충분하면 종료(end)해도 돼

아래 JSON 형식으로만 응답해.
{
  "next": "librarian" | "wordsmith" | "chief" | "end",
  "reason": "왜 그렇게 정했는지 짧게"
}
`.trim();

  const { data, usage } = await callLLMJson<{ next: string; reason: string }>({
    systemPrompt: CHIEF_EVALUATOR.systemPrompt,
    userPrompt,
  });

  // 발언권 없는 사람을 지목했으면 보정
  let next = data.next as "librarian" | "wordsmith" | "chief" | "end";
  if (next === "librarian" && remaining.librarian <= 0) next = "chief";
  if (next === "wordsmith" && remaining.wordsmith <= 0) next = "chief";

  return { next, usage };
}

/**
 * 지목된 평가자가 발언 생성.
 */
export async function generateSpeech(
  speakerId: "librarian" | "wordsmith" | "chief",
  text: string,
  history: DiscussionMessage[]
): Promise<{ message: DiscussionMessage; usage: LLMUsage }> {
  const speaker = SPEAKERS[speakerId];

  // 역할별 집중 지시
  const roleGuide: Record<string, string> = {
    librarian:
      "너는 '사실성/근거'만 본다. 글의 특정 주장·통계·사례를 콕 집어서, 그게 사실인지·출처가 있는지·과장은 없는지 지적해. 문장 표현이나 구성 얘기는 하지 마. 그건 네 담당이 아니야.",
    wordsmith:
      "너는 '문장/표현/구성'만 본다. 특정 문장이나 문단을 콕 집어서, 어색한 표현·중복·구조 문제를 지적하고 어떻게 고칠지 제안해. 사실 여부나 근거 얘기는 하지 마. 그건 네 담당이 아니야.",
    chief:
      "너는 사회자다. 논의를 정리하거나, 평가자들이 놓친 큰 그림(글의 목적·독자·전체 흐름)을 짚어. 세부 반복은 하지 마.",
  };

  const userPrompt = `
너는 "${speaker.name}"로서 글 평가 회의에 참여 중이야.

[너의 역할 - 이것만 집중해]
${roleGuide[speakerId]}

[평가 대상 글]
${text}

[지금까지의 대화]
${formatHistory(history)}

규칙:
- 앞사람 말을 반복하거나 그냥 "동의해요"라고 하지 마. 반드시 '새로운' 지적을 해.
- 글에서 구체적인 부분(문장/주장/단어)을 직접 인용하며 말해.
- 다른 평가자와 의견이 다르면 다르다고 말해도 돼.
- 한두 문장으로 간결하게, 회의하듯 자연스럽게.

아래 JSON 형식으로만 응답해.
{
  "message": "너의 발언 (한두 문장, 구체적으로)"
}
`.trim();

  const { data, usage } = await callLLMJson<{ message: string }>({
    systemPrompt: speaker.prompt,
    userPrompt,
  });

  return {
    message: { speakerId, speakerName: speaker.name, message: data.message },
    usage,
  };
}

/**
 * 평가원의 마지막 종합 정리 + 수정 제안.
 */
export async function generateSummary(
  text: string,
  history: DiscussionMessage[]
): Promise<{ message: DiscussionMessage; usage: LLMUsage }> {
  const userPrompt = `
너는 사회자(평가원)로서 글 평가 회의를 마무리해야 해.

[평가 대상 글]
${text}

[전체 대화]
${formatHistory(history)}

지금까지의 논의를 종합해서, 이 글을 어떻게 개선하면 좋을지 구체적인 수정 제안을 정리해줘.
평가자들의 지적을 반영한 실질적인 조언으로.

아래 JSON 형식으로만 응답해.
{
  "message": "종합 정리 및 수정 제안 (3~5문장)"
}
`.trim();

  const { data, usage } = await callLLMJson<{ message: string }>({
    systemPrompt: CHIEF_EVALUATOR.systemPrompt,
    userPrompt,
  });

  return {
    message: { speakerId: "chief", speakerName: `${CHIEF_EVALUATOR.name} (종합)`, message: data.message },
    usage,
  };
}

/**
 * 논의 내용을 취합해서 개선된 수정본을 생성.
 */
export async function generateRevision(
  originalText: string,
  history: DiscussionMessage[]
): Promise<{ revised: string; usage: LLMUsage }> {
  const userPrompt = `
아래는 원본 글과, 평가단이 이 글을 두고 나눈 회의 내용이야.
회의에서 나온 지적들을 최대한 반영해서, 원본 글을 개선한 '수정본'을 작성해줘.

[원본 글]
${originalText}

[평가단 회의 내용]
${formatHistory(history)}

규칙:
- 회의에서 지적된 문제(사실성, 문장, 구성 등)를 실제로 반영해서 고쳐.
- 원본의 핵심 주제와 논지는 유지해.
- 완성된 하나의 글로 작성해. (지적 목록이 아니라 실제 개선된 글)

아래 JSON 형식으로만 응답해.
{
  "revised": "개선된 글 전문"
}
`.trim();

  const { data, usage } = await callLLMJson<{ revised: string }>({
    systemPrompt: CHIEF_EVALUATOR.systemPrompt,
    userPrompt,
  });

  return { revised: data.revised, usage };
}