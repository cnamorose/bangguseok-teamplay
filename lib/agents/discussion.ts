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

// usage 합산 (novelty 검사 등으로 호출이 여러 번 나뉠 때)
const ZERO_USAGE: LLMUsage = { model: "", inputTokens: 0, outputTokens: 0, cost: 0 };
function addUsage(a: LLMUsage, b: LLMUsage): LLMUsage {
  return {
    model: b.model || a.model,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cost: a.cost + b.cost,
  };
}

/**
 * 새 발언이 기존 발언들과 '실질적으로 같은 지적'인지 판정.
 * 표현만 다르고 핵심이 같으면 중복(true).
 */
async function judgeDuplicate(
  candidate: string,
  history: DiscussionMessage[]
): Promise<{ duplicate: boolean; usage: LLMUsage }> {
  const prior = history.map((m, i) => `${i + 1}. ${m.speakerName}: ${m.message}`).join("\n");

  const userPrompt = `
너는 회의 발언들이 서로 중복되는지 가려내는 심판이야.

[기존 발언들]
${prior}

[새 발언]
${candidate}

새 발언이 기존 발언 중 하나와 '실질적으로 같은 지적'인지 판단해.
- 글의 같은 부분을 같은 이유로 지적하면 → 중복(true). 표현·문장이 달라도 핵심이 같으면 true.
- 글의 다른 부분을 짚거나, 새로운 근거·관점을 더하면 → 새로움(false).

아래 JSON 형식으로만 응답해.
{ "duplicate": true 또는 false }
`.trim();

  const { data, usage } = await callLLMJson<{ duplicate: boolean }>({ userPrompt });
  return { duplicate: !!data.duplicate, usage };
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

  // 이미 나온 지적 목록 (특히 본인 발언) — 반복 방지용으로 모델에게 명시
  const priorPoints =
    history.length > 0
      ? history.map((m, i) => `${i + 1}. ${m.speakerName}: ${m.message}`).join("\n")
      : "(아직 없음)";

  const buildPrompt = (avoid: string) =>
    `
너는 "${speaker.name}"로서 글 평가 회의에 참여 중이야.

[너의 역할 - 이것만 집중해]
${roleGuide[speakerId]}

[평가 대상 글]
${text}

[이미 나온 지적들 - 절대 반복 금지]
${priorPoints}

규칙:
- 위 [이미 나온 지적들]과 같은 내용을 다시 말하지 마. 특히 네가 이미 한 지적을 되풀이하지 마.
- 표현만 바꿔서 같은 얘기를 하는 것도 금지. 아직 아무도 짚지 않은 '새로운' 부분을 지적해.
- 글에서 구체적인 부분(문장/주장/단어)을 직접 인용하며 말해.
- 다른 평가자와 의견이 다르면 다르다고 말해도 돼.
- 한두 문장으로 간결하게, 회의하듯 자연스럽게.
${avoid ? `\n[특히 이 발언은 방금 중복으로 걸렀으니 이것과 다른 내용을 말해]\n"${avoid}"\n` : ""}
아래 JSON 형식으로만 응답해.
{
  "message": "너의 발언 (한두 문장, 구체적으로)"
}
`.trim();

  let totalUsage = ZERO_USAGE;
  let avoid = "";
  let lastMessage = "";
  const maxTries = 3;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const { data, usage } = await callLLMJson<{ message: string }>({
      systemPrompt: speaker.prompt,
      userPrompt: buildPrompt(avoid),
    });
    totalUsage = addUsage(totalUsage, usage);

    const candidate = (data.message ?? "").trim();
    if (!candidate) continue; // 빈 응답이면 lastMessage 갱신 없이 재시도

    lastMessage = candidate;

    // 첫 발언(대화 시작)이면 비교할 게 없으니 그대로 채택
    if (history.length === 0) break;

    const dup = await judgeDuplicate(candidate, history);
    totalUsage = addUsage(totalUsage, dup.usage);

    if (!dup.duplicate) break; // 새로운 지적 → 채택
    avoid = candidate; // 중복 → 이 문장을 피해서 다시
  }

  return {
    message: { speakerId, speakerName: speaker.name, message: lastMessage },
    usage: totalUsage,
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