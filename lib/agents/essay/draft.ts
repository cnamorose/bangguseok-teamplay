import { callLLMJson, LLMUsage } from "@/lib/ai";
import { countChars, fitToLength, lengthInstruction, trimToSentenceEnd } from "@/lib/agents/length";
import { AI_PHRASES, CLICHE_PHRASES, AiTell, inspectAiTells } from "./ai-tells";
import { getKind } from "./kinds";
import { CompanyAnalysis, RoleAnalysis } from "@/lib/agents/company/types";

// 자소서 초안.
//
// 재료가 셋이다 — 문항 / 내 경험 / 회사·직무 분석.
// 셋 다 있어야 "어느 회사에 내도 무방한 글"을 피할 수 있다.
// 특히 경험이 없으면 아예 부르지 않는다 (호출부에서 막는다).

export interface DraftExperience {
  id: string;
  title: string;
  period?: string | null;
  role?: string | null;
  situation?: string | null;
  action?: string | null;
  impact?: string | null;
  learning?: string | null;
  message?: string | null;
  tags: string[];
}

export interface DraftInput {
  companyName: string;
  role: string;
  prompt: string;      // 문항
  kind: string;        // 문항 유형
  maxChars?: number;
  tone?: "result" | "process" | "plain";
  experiences: DraftExperience[];
  company?: CompanyAnalysis | null;
  roleAnalysis?: RoleAnalysis | null;
}

export interface DraftQuestion {
  about: string;    // 무엇에 대한 질문인지
  question: string; // 사용자에게 되묻는 것
}

export interface DraftResult {
  content: string;
  /** 정보가 부족해 뭉뚱그린 부분 — 답을 받아 다시 뽑으면 좋아진다 */
  questions: DraftQuestion[];
  /** 첫문장을 어떤 방식으로 열었는지 (수치형·질문형·두괄식·스토리형·선언형) */
  opening: string;
  /** 자동 교정을 몇 번 돌렸는지 (0이면 처음부터 깨끗했다) */
  polished: number;
}

const TONE_GUIDE: Record<string, string> = {
  result: "성과와 결과를 앞세워라. 첫문장을 수치나 구체적 결과로 열어라.",
  process: "과정과 배움을 중심에 둬라. 무엇을 왜 그렇게 했는지가 잘 보이게.",
  plain: "담백하고 차분하게. 수식어를 줄이고 사실 위주로.",
};

function formatExperience(e: DraftExperience): string {
  const rows = [
    ["경험", e.title],
    ["기간", e.period],
    ["역할", e.role],
    ["상황·문제", e.situation],
    ["내가 한 일", e.action],
    ["결과", e.impact],
    ["배운 점", e.learning],
    ["한 줄 메시지", e.message],
    ["키워드", e.tags.join(", ")],
  ].filter(([, v]) => v && String(v).trim());

  return rows.map(([k, v]) => `  ${k}: ${v}`).join("\n");
}

function formatCompany(c?: CompanyAnalysis | null, r?: RoleAnalysis | null): string {
  if (!c && !r) return "(회사 분석 자료 없음 — 회사에 대한 구체적 언급은 하지 마라)";

  const parts: string[] = [];
  if (c) {
    parts.push(`- 지금 ${c.headline.cause} 때문에 ${c.headline.direction}을 강화하는 중`);
    if (c.identity?.summary) parts.push(`- 사업: ${c.identity.summary}`);
    if (c.shift?.conclusion) parts.push(`- 변화: ${c.shift.conclusion}`);
    if (c.edge) parts.push(`- 이 회사만의 강점: ${c.edge}`);
    const official = (c.language ?? []).filter((w) => w.official).map((w) => w.word);
    if (official.length) parts.push(`- 회사가 실제로 쓰는 말: ${official.join(", ")}`);
  }
  if (r?.requirements?.length) {
    parts.push(`- 직무 요구 역량: ${r.requirements.join(" / ")}`);
  }
  if (r?.linkToStrategy) parts.push(`- 직무와 회사 방향의 접점: ${r.linkToStrategy}`);
  return parts.join("\n");
}

/**
 * 검증기가 잡은 자국을 그대로 되먹여 고치게 한다.
 * 길이를 코드로 세서 맞추는 것(fitToLength)과 같은 방식이다 —
 * 기계가 셀 수 있는 것은 기계가 세고, 고치는 일만 LLM에게 맡긴다.
 */
async function polish(
  content: string,
  tells: AiTell[],
  systemPrompt: string
): Promise<{ content: string; usage: LLMUsage }> {
  const points = tells
    .map((t) => `- ${t.title}: ${t.detail}${t.sample ? `\n  걸린 문장: "${t.sample}"` : ""}`)
    .join("\n");

  const userPrompt = `
아래 자기소개서에서 'AI가 쓴 티'로 지적된 곳을 고쳐라.

[글]
${content}

[지적된 곳]
${points}

[고치는 규칙]
- **내용·사실·숫자는 절대 바꾸지 마라.** 표현만 손본다.
- 없는 내용을 새로 넣지 마라. 문장을 나누거나 표현을 바꾸는 선에서 해결해라.
- 쉼표가 많으면 그 자리에서 문장을 끊어라.
- 문장 길이가 고르면 짧은 문장을 섞어 리듬을 만들어라.
- 접속사(또한·게다가·결과적으로·이를 통해)는 문맥으로 통하면 지워라.
- 지적된 표현은 같은 뜻의 자연스러운 우리말로 바꿔라.
- 전체 분량은 지금과 비슷하게 유지해라.

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{ "content": "고친 글 전문" }
`.trim();

  const { data, usage } = await callLLMJson<{ content: string }>({ systemPrompt, userPrompt });
  return { content: (data.content ?? "").trim() || content, usage };
}

export async function draftEssay(
  input: DraftInput
): Promise<{ result: DraftResult; usages: LLMUsage[] }> {
  const spec = getKind(input.kind);
  const target = input.maxChars && input.maxChars > 0 ? input.maxChars : spec.defaultChars;
  const usages: LLMUsage[] = [];

  const systemPrompt = `너는 ${input.role} 채용을 10년간 담당한 인사담당관이자 자기소개서 코치다.
지원자가 실제로 겪은 일만 가지고 글을 쓴다. 없는 경험·수치·성과는 절대 만들지 않는다.
정보가 부족하면 뭉뚱그려 채우지 말고, 그 부분을 질문으로 돌려준다.`;

  const userPrompt = `
[지원 정보]
회사: ${input.companyName}
직무: ${input.role}

[문항] (${spec.label})
${input.prompt}

[이 문항에서 평가자가 보려는 것]
${spec.looksFor}

[구성]
${spec.structure}

[지원자의 경험 — 이 안에 있는 사실만 써라]
${input.experiences.map(formatExperience).join("\n\n")}

[회사·직무 분석]
${formatCompany(input.company, input.roleAnalysis)}

[반드시 지킬 것]
- **경험에 없는 사실·숫자·성과를 만들지 마라.** 이게 가장 중요하다.
  구체화할 정보가 부족하면 그 문장을 뭉뚱그리지 말고 questions에 질문으로 담아라.
- 첫문장이 전체 인상을 정한다. 아래 다섯 중 하나로 열어라.
  수치형 / 질문형 / 두괄식 / 스토리형 / 선언형
  "저는 ~한 사람입니다" 같은 자기 정의로 시작하지 마라.
- 회사 이름만 바꾸면 다른 회사에도 낼 수 있는 문장이면 실패다.

[AI가 쓴 티를 없애는 규칙 — 인사 담당자가 1차로 걸러내는 지점이다]
- **한 문장에 쉼표는 최대 1개.** 쉼표를 더 넣고 싶으면 거기서 문장을 끊어라.
  나쁨: "팀장을 맡아, 의견을 조율하며, 문제를 해결하기 위해 노력했고, 성공적으로 마쳤습니다"
  좋음: "팀장으로서 팀원들의 의견을 조율했습니다. 문제 해결에 집중한 결과 프로젝트를 완수했습니다"
- **문장 길이에 리듬을 줘라.** 긴 문장 뒤에는 짧고 강한 한 문장을 놓아라.
  길이가 다 비슷하면 기계가 쓴 티가 난다. 90자를 넘는 문장은 두 개로 쪼개라.
- **접속사를 지워라.** '또한 · 게다가 · 결과적으로 · 이를 통해'는 문맥으로 통하면 빼라.
- **경험에 있는 고유명사를 그대로 살려라.** 도구 이름, 공모전의 정확한 명칭, 팀 이름, 수치.
  "프로젝트"가 아니라 그 프로젝트의 이름을, "협업했다"가 아니라 어느 팀과 했는지 써라.
  AI는 이런 걸 모르기 때문에, 있으면 그만큼 사람 글로 읽힌다.
- **번역투와 수동태를 쓰지 마라.** "~에 다름 아닙니다", "~를 가집니다", "~되어집니다" 금지.
- 다음 표현은 절대 쓰지 마라:
  ${AI_PHRASES.map((p) => p.phrase).join(", ")}
  ${CLICHE_PHRASES.join(", ")}
- 마무리를 "기여하겠습니다", "인재가 되겠습니다"로 하지 마라.
  회사가 지금 하는 일과 이어서 "무엇을 하겠다"로 끝내라.
${spec.avoid}
${input.tone ? `- 톤: ${TONE_GUIDE[input.tone]}` : ""}

[분량]
공백 포함 ${target}자 내외로.

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{
  "content": "자기소개서 본문",
  "opening": "첫문장 유형 (수치형|질문형|두괄식|스토리형|선언형)",
  "questions": [{ "about": "어느 부분", "question": "채우려면 무엇을 알아야 하는지" }]
}
`.trim();

  const { data, usage } = await callLLMJson<{
    content: string;
    opening: string;
    questions: DraftQuestion[];
  }>({ systemPrompt, userPrompt });
  usages.push(usage);

  let content = (data.content ?? "").trim();

  // ── AI 티 자동 교정 ──
  // 프롬프트로 금지해도 새어 나오므로, 검증기로 잡아 되먹인다.
  // '고침 권장(high)'만 대상으로 한다 — 리듬 같은 건 오탐이 있어 억지로 고치면 더 어색해진다.
  let polished = 0;
  for (let i = 0; i < 2; i++) {
    const tells = inspectAiTells(content).filter((t) => t.severity === "high");
    if (tells.length === 0) break;

    const fixed = await polish(content, tells, systemPrompt);
    usages.push(fixed.usage);
    content = fixed.content;
    polished++;
  }

  // 글자수 제한은 사실상 규칙이라 넘기면 제출이 안 된다. 코드로 세서 맞춘다.
  if (content && input.maxChars && input.maxChars > 0) {
    content = await fitToLength({
      target: input.maxChars,
      tol: 50,
      maxTries: 2,
      initial: content,
      measure: (s) => countChars(s),
      revise: async (s, cur) => {
        const p = `
아래 자기소개서를 '길이만' 맞춰서 다시 써라. 내용·사실·구조는 그대로 둔다.

[글]
${s}

${lengthInstruction(cur, input.maxChars!, 50)}

길이를 조절하면서도 지킬 것:
- 한 문장에 쉼표는 최대 1개. 늘릴 때 쉼표로 잇지 말고 문장을 새로 만들어라.
- 문장 길이를 고르게 만들지 마라. 짧은 문장이 섞여 있어야 한다.
- 접속사(또한·게다가·결과적으로)를 넣어 늘리지 마라.

아래 JSON으로만 응답해.
{ "content": "길이를 맞춘 글" }
`.trim();
        const r = await callLLMJson<{ content: string }>({ systemPrompt, userPrompt: p });
        return { value: r.data.content || s, usage: r.usage };
      },
      onUsage: (u) => usages.push(u),
    });

    // 그래도 넘치면 문장 끝에서 자른다 (상한은 반드시 지켜야 하므로)
    if (countChars(content) > input.maxChars) {
      content = trimToSentenceEnd(content, input.maxChars);
    }
  }

  return {
    result: {
      content,
      opening: data.opening ?? "",
      questions: Array.isArray(data.questions) ? data.questions.slice(0, 3) : [],
      polished,
    },
    usages,
  };
}
