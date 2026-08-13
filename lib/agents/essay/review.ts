import { callLLMJson, LLMUsage } from "@/lib/ai";
import { scoreByRubric } from "@/lib/agents/rubric";
import { reviseText } from "@/lib/agents/revise";
import { EvaluationResult } from "@/lib/pipeline-types";
import {
  ESSAY_CHIEF,
  ESSAY_PROMPT_KEEPER,
  ESSAY_FACT_CHECKER,
  ESSAY_STYLIST,
} from "@/lib/evaluators";
import { getKind } from "./kinds";
import { inspectAiTells } from "./ai-tells";
import { DraftExperience } from "./draft";

// 자소서 첨삭단.
//
// 채점 절차와 수정본 생성은 공부방 평가단과 같은 함수를 쓴다(rubric.ts, revise.ts).
// 다른 건 '무엇을 보느냐'뿐이다.
//
// 특히 경험 대조관은 공부방의 '인간 도서관' 자리인데, 대조 상대가 웹이 아니라
// 사용자가 등록해 둔 경험이다. 없는 경험이 자소서에 들어가는 게 최악의 사고라서.

export interface ReviewInput {
  companyName: string;
  role: string;
  prompt: string;   // 문항
  kind: string;
  maxChars?: number | null;
  text: string;     // 첨삭할 자소서
  experiences: DraftExperience[];
}

/** 첨삭 포인트 한 줄 */
export interface ReviewPoint {
  where: string;    // 어느 부분
  problem: string;  // 무엇이 문제인지
  fix: string;      // 어떻게 고칠지
}

function expSummary(list: DraftExperience[]): string {
  if (list.length === 0) return "(등록된 경험 없음 — 대조할 수 없으니 이 항목은 후하게 주지 말고 보통으로 두고, 코멘트에 '경험을 등록하면 대조해 드릴 수 있다'고 적어라)";
  return list
    .map((e) =>
      [
        `· ${e.title}`,
        e.period && `  기간: ${e.period}`,
        e.role && `  역할: ${e.role}`,
        e.situation && `  상황: ${e.situation}`,
        e.action && `  한 일: ${e.action}`,
        e.impact && `  결과: ${e.impact}`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
}

function header(input: ReviewInput): string {
  const spec = getKind(input.kind);
  return `
[지원 정보] ${input.companyName} · ${input.role}
[문항] (${spec.label}) ${input.prompt}
[이 문항에서 평가자가 보려는 것] ${spec.looksFor}
[이 유형에서 특히 조심할 것]
${spec.avoid}
${input.maxChars ? `[분량] ${input.maxChars}자 이내` : ""}
`.trim();
}

/** ① 인사담당관 — 종합 */
export async function reviewChief(input: ReviewInput) {
  const r = await scoreByRubric({
    systemPrompt: ESSAY_CHIEF.systemPrompt,
    taskPrompt: `${header(input)}\n\n[자기소개서]\n${input.text}\n\n이 글을 인사담당관 입장에서 평가해라.`,
    rubric: ESSAY_CHIEF.rubric,
  });
  return toResult(ESSAY_CHIEF, r);
}

/** ② 문항 지킴이 — 문항이 물은 걸 답했나 */
export async function reviewPrompt(input: ReviewInput) {
  const r = await scoreByRubric({
    systemPrompt: ESSAY_PROMPT_KEEPER.systemPrompt,
    taskPrompt:
      `${header(input)}\n\n[자기소개서]\n${input.text}\n\n` +
      "이 글이 문항이 물은 것에 답했는지, 이 유형이 요구하는 초점에 맞는지 평가해라.",
    rubric: ESSAY_PROMPT_KEEPER.rubric,
  });
  return toResult(ESSAY_PROMPT_KEEPER, r);
}

/** ③ 경험 대조관 — 등록된 경험과 대조 (공부방의 웹 검색 자리) */
export async function reviewExperience(input: ReviewInput) {
  const r = await scoreByRubric({
    systemPrompt: ESSAY_FACT_CHECKER.systemPrompt,
    taskPrompt: `
[자기소개서]
${input.text}

[지원자가 등록해 둔 경험 — 이것이 사실의 기준이다]
${expSummary(input.experiences)}

자소서에 적힌 사실·숫자·역할이 등록된 경험에 실제로 있는지 대조해라.
경험에 없는 내용이 있으면 코멘트에 그 문장을 그대로 인용해서 짚어라.
`.trim(),
    rubric: ESSAY_FACT_CHECKER.rubric,
  });
  return toResult(ESSAY_FACT_CHECKER, r);
}

/** ④ 문장 검수관 — 코드로 센 AI 자국을 근거로 준다 */
export async function reviewStyle(input: ReviewInput) {
  const tells = inspectAiTells(input.text);
  const tellText =
    tells.length > 0
      ? tells.map((t) => `- ${t.title}: ${t.detail}`).join("\n")
      : "(기계 검사에서는 걸린 것이 없다. 그래도 사람 눈으로 어색한 곳이 있는지 보라)";

  const r = await scoreByRubric({
    systemPrompt: ESSAY_STYLIST.systemPrompt,
    taskPrompt: `
[자기소개서]
${input.text}

[기계 검사 결과 — 쉼표·상투어·접속사·문장 길이를 세어 본 것]
${tellText}

위 검사 결과를 근거로 삼되, 첫 문장과 마지막 문장은 직접 읽고 판단해라.
`.trim(),
    rubric: ESSAY_STYLIST.rubric,
  });
  return toResult(ESSAY_STYLIST, r);
}

function toResult(
  e: typeof ESSAY_CHIEF,
  r: { total: number; breakdown: EvaluationResult["breakdown"]; comment: string; usage: LLMUsage }
): { result: EvaluationResult; usage: LLMUsage } {
  return {
    result: {
      evaluatorId: e.id,
      evaluatorName: e.name,
      scoreLabel: e.scoreLabel,
      score: r.total,
      maxScore: e.maxScore,
      comment: r.comment,
      breakdown: r.breakdown,
    },
    usage: r.usage,
  };
}

/** 네 명의 코멘트를 모아 고칠 곳을 짚는다 */
export async function collectPoints(
  input: ReviewInput,
  results: EvaluationResult[]
): Promise<{ points: ReviewPoint[]; usage: LLMUsage }> {
  const comments = results.map((r) => `- ${r.evaluatorName}: ${r.comment}`).join("\n");

  const { data, usage } = await callLLMJson<{ points: ReviewPoint[] }>({
    systemPrompt: ESSAY_CHIEF.systemPrompt,
    userPrompt: `
${header(input)}

[자기소개서]
${input.text}

[첨삭단 코멘트]
${comments}

위 코멘트를 종합해서, 이 글에서 **실제로 고칠 곳** 3~5개를 짚어라.
- where에는 어느 부분인지 알 수 있게 원문을 짧게 인용해라.
- fix는 "구체적으로 쓰세요" 같은 말 대신, 어떻게 고치라는 건지 알 수 있게 써라.
- 원문에 없는 사실을 만들어 넣으라고 하지 마라.

아래 JSON으로만 응답해.
{ "points": [{ "where": "원문 인용", "problem": "무엇이 문제인지", "fix": "어떻게 고칠지" }] }
`.trim(),
  });

  return {
    points: Array.isArray(data.points) ? data.points.slice(0, 5) : [],
    usage,
  };
}

/** 첨삭 포인트를 반영한 수정본 (공용 revise 사용) */
export async function reviseEssay(
  input: ReviewInput,
  points: ReviewPoint[],
  userOpinion?: string
): Promise<{ revised: string; usages: LLMUsage[] }> {
  return reviseText({
    original: input.text,
    points: points.map((p) => `- ${p.where} → ${p.problem} / ${p.fix}`).join("\n"),
    pointsLabel: "첨삭단이 짚은 곳",
    userOpinion,
    targetLength: input.maxChars ?? undefined,
    systemPrompt: ESSAY_CHIEF.systemPrompt,
    extraRules: `
- 한 문장에 쉼표는 최대 1개. 더 넣고 싶으면 문장을 끊어라.
- 접속사(또한·게다가·결과적으로)를 넣지 마라.
- 문장 길이에 리듬을 줘라. 짧은 문장을 섞어라.
- "기여하겠습니다", "역량을 함양" 같은 상투어를 쓰지 마라.`.trim(),
  });
}
