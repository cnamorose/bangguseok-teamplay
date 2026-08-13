import { callLLMJson, LLMUsage } from "@/lib/ai";
import { CompanyAnalysis, RoleAnalysis } from "@/lib/agents/company/types";
import { getInterviewer, Interviewer } from "./interviewers";

// 다음 질문 만들기.
//
// 누가 물을지와 무엇을 물을지를 한 번에 정한다. (두 번 부르면 비용이 두 배인데
// 얻는 게 없다 — 어차피 같은 맥락을 보고 정하는 판단이다)
//
// 면접의 압박은 발성이 아니라 '예상 못 한 꼬리질문'에서 온다. 그래서 자소서에
// 쓴 문장을 그대로 인용해 되묻게 하는 것이 이 프롬프트의 핵심이다.

export interface Turn {
  role: "interviewer" | "candidate";
  speaker?: string;   // 면접관 id
  content: string;
  seconds?: number;   // 답변에 걸린 시간
  over?: boolean;     // 제한시간 초과 여부
  /** 답변으로 볼 수 없는 입력이면 이유가 들어간다 (자판을 두드린 경우 등) */
  invalid?: string;
}

export interface AskContext {
  companyName: string;
  role: string;
  interviewers: Interviewer[];
  company?: CompanyAnalysis | null;
  roleAnalysis?: RoleAnalysis | null;
  /** 지원자가 낸 자소서 — 꼬리질문의 가장 좋은 재료 */
  essays: { prompt: string; content: string }[];
  experiences: { title: string; role?: string | null; action?: string | null; impact?: string | null }[];
  turns: Turn[];
  /** 남은 답변 횟수 */
  remaining: number;
}

export interface AskResult {
  interviewerId: string;
  question: string;
  /** 직전 답변을 파고드는 꼬리질문인지 */
  followUp: boolean;
}

function formatTurns(turns: Turn[]): string {
  if (turns.length === 0) return "(아직 시작 전)";
  return turns
    .map((t) =>
      t.role === "interviewer"
        ? `면접관(${getInterviewer(t.speaker ?? "").name}): ${t.content}`
        : t.invalid
          ? `지원자: (답변으로 볼 수 없는 입력 — ${t.invalid})`
          : `지원자: ${t.content}`
    )
    .join("\n");
}

function material(ctx: AskContext): string {
  const parts: string[] = [];

  if (ctx.company) {
    parts.push(
      `[회사] 지금 ${ctx.company.headline.cause} 때문에 ${ctx.company.headline.direction}을 강화하는 중` +
        (ctx.company.shift?.conclusion ? `\n변화: ${ctx.company.shift.conclusion}` : "")
    );
  }
  if (ctx.roleAnalysis?.requirements?.length) {
    parts.push(`[이 직무의 요구사항]\n${ctx.roleAnalysis.requirements.map((r) => `- ${r}`).join("\n")}`);
  }
  if (ctx.essays.length > 0) {
    parts.push(
      `[지원자가 낸 자기소개서 — 여기 쓴 문장을 그대로 인용해 되묻는 것이 가장 좋은 질문이다]\n` +
        ctx.essays.map((e) => `문항: ${e.prompt}\n답변: ${e.content}`).join("\n\n")
    );
  }
  if (ctx.experiences.length > 0) {
    parts.push(
      `[지원자가 등록한 경험]\n` +
        ctx.experiences
          .map((e) => `- ${e.title}${e.role ? ` (${e.role})` : ""}${e.action ? `: ${e.action}` : ""}`)
          .join("\n")
    );
  }
  return parts.join("\n\n") || "(참고 자료 없음 — 일반적인 면접 질문으로 진행한다)";
}

export async function askNext(ctx: AskContext): Promise<{ result: AskResult; usage: LLMUsage }> {
  const roster = ctx.interviewers
    .map((i) => `- ${i.id} (${i.name}): ${i.focus}`)
    .join("\n");

  const last = ctx.turns[ctx.turns.length - 1];
  const justAnswered = last?.role === "candidate";
  const lastInvalid = justAnswered && !!last.invalid;

  const userPrompt = `
"${ctx.companyName}" ${ctx.role} 직무 면접이 진행 중이다. 다음 질문 하나를 만들어라.

[면접관들]
${roster}

${material(ctx)}

[지금까지의 면접]
${formatTurns(ctx.turns)}

[남은 답변 횟수] ${ctx.remaining}회

[질문 규칙]
- **질문은 하나만.** 여러 개를 한 번에 묻지 마라.
- 지원자가 방금 한 답변에 근거가 빠졌거나 두루뭉술하면 **꼬리질문**을 달아라.
  꼬리질문이 이 면접의 핵심이다. 답변에서 그 사람이 쓴 표현을 그대로 인용해서 물어라.
  예) "캐싱을 넣었다고 하셨는데, 인덱스로 해결하지 않은 이유가 뭔가요?"
- 자기소개서에 쓴 내용은 **이미 읽은 것으로 전제**하고 물어라. 자소서를 다시 읽어달라고 하지 마라.
- 이미 물어본 것을 다시 묻지 마라. (같은 주제를 더 파는 꼬리질문은 괜찮다)
- 남은 횟수가 2회 이하면 마무리로 갈 수 있는 질문(포부·마지막 할 말 등)을 골라라.
- 실제 면접관처럼 말해라. 설명이나 격려를 붙이지 말고 질문만.
${justAnswered ? "" : "- 첫 질문이다. 자기소개나 지원동기처럼 문을 여는 질문으로 시작해라."}
${
  lastInvalid
    ? `- **직전 답변이 답변이 아니었다.** 새 질문으로 넘어가지 말고, 실제 면접관처럼
  방금 그 질문을 다시 물어라. ("잘 못 들었습니다. 다시 말씀해 주시겠어요?" 같은 식으로 짧게)
  없는 답변을 좋게 해석하지 마라.`
    : ""
}

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{
  "interviewerId": "${ctx.interviewers.map((i) => i.id).join(" | ")}",
  "question": "질문 (한두 문장)",
  "followUp": true 또는 false
}
`.trim();

  const { data, usage } = await callLLMJson<AskResult>({
    systemPrompt:
      "너는 실제 채용 면접을 진행하는 면접관이다. 짧고 날카롭게 묻는다. " +
      "지원자를 가르치거나 격려하지 않고, 판단에 필요한 것만 묻는다.",
    userPrompt,
  });

  // 없는 면접관을 지목했으면 보정
  const valid = ctx.interviewers.some((i) => i.id === data.interviewerId);
  return {
    result: {
      interviewerId: valid ? data.interviewerId : ctx.interviewers[0].id,
      question: (data.question ?? "").trim() || "간단히 자기소개 부탁드립니다.",
      followUp: !!data.followUp,
    },
    usage,
  };
}
