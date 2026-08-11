import { callLLMJson, LLMUsage } from "@/lib/ai";
import { runSearch } from "./search";
import { runGenerate } from "./generate";
import { runOrganize } from "./organize";
import { runVisualize, refitVisualize } from "./visualize";
import { runCritic } from "./critic";
import { fitToLength, countChars } from "./length";
import { extractArticleText } from "@/lib/result-text";
import {
  SearchOutput,
  GenerateOutput,
  OrganizeOutput,
  VisualizeOutput,
  CriticResult,
} from "@/lib/pipeline-types";

// 하이브리드 다이나믹 멀티 에이전트 생성
// - 뼈대(리서치 → 초안 → … → 정리 → 시각화)는 유지
// - 초안 개선 '루프의 분기'만 편집장(지휘자)이 매 라운드 동적으로 결정한다.

export interface Assembly {
  searchPersona: string;
  generatePersona: string;
  organizePersona: string;
  visualizePersona: string;
}

export type StepAction = "research" | "rewrite" | "finalize";

export interface OrchestratorCallbacks {
  // 진행상황(SSE) 메시지
  progress: (message: string, stage?: string) => void;
  // 각 단계 결과를 저장(agentLog + usage). countProgress=true면 진행바 한 칸 전진.
  persist: (
    stage: string,
    persona: string,
    output: unknown,
    usage: LLMUsage | null,
    countProgress: boolean
  ) => Promise<void>;
}

export interface GenerationResult {
  search: SearchOutput;
  generate: GenerateOutput;
  organize: OrganizeOutput;
  visualize: VisualizeOutput;
}

// 편집장(지휘자): 비평 지적을 보고 팀에게 무엇을 시킬지 결정
async function decideNextStep(
  topic: string,
  draft: GenerateOutput,
  critique: CriticResult,
  budget: { research: number; rewrite: number }
): Promise<{ action: StepAction; reason: string; query: string; usage: LLMUsage }> {
  const options: string[] = [];
  if (budget.research > 0)
    options.push(`"research" — 사실·근거가 부족하면 추가 웹검색을 지시(검색어 query 제시). 남은 ${budget.research}회`);
  if (budget.rewrite > 0)
    options.push(`"rewrite" — 문장·구성 문제면 다시 쓰게 지시. 남은 ${budget.rewrite}회`);
  options.push(`"finalize" — 충분하면 마무리로 넘어감`);

  const userPrompt = `
너는 글쓰기 팀의 편집장(지휘자)이야. 비평가가 초안을 지적했어.
이 지적을 해결하려면 팀에게 무엇을 시킬지 하나만 결정해.

[주제] ${topic}
[현재 초안 제목] ${draft.title}
[현재 초안 본문]
${draft.content}

[비평가 지적]
${critique.feedback}

[가능한 지시] (예산 없는 항목은 고르지 마)
${options.map((o) => `- ${o}`).join("\n")}

판단 기준:
- 지적이 '사실 여부·근거·출처'에 관한 것이면 → research
- 지적이 '문장·표현·구성'에 관한 것이면 → rewrite
- 지적이 사소하거나 이미 충분하면 → finalize

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{ "action": "research" | "rewrite" | "finalize", "reason": "왜 이 지시인지 한 문장", "query": "research일 때만 검색어, 아니면 빈 문자열" }
`.trim();

  const { data, usage } = await callLLMJson<{ action: string; reason: string; query: string }>({
    systemPrompt: "너는 팀의 흐름을 지휘하는 냉정한 편집장이다. 남은 예산 안에서 가장 효율적인 다음 행동을 고른다.",
    userPrompt,
  });

  // 예산·유효성 보정
  let action = data.action as StepAction;
  if (action === "research" && budget.research <= 0) action = budget.rewrite > 0 ? "rewrite" : "finalize";
  if (action === "rewrite" && budget.rewrite <= 0) action = "finalize";
  if (action !== "research" && action !== "rewrite" && action !== "finalize") action = "finalize";

  return { action, reason: data.reason || "", query: data.query || "", usage };
}

// 두 검색 결과 합치기 (중복 제거)
function mergeSearch(a: SearchOutput, b: SearchOutput): SearchOutput {
  const uniq = (arr: string[]) => Array.from(new Set(arr));
  return {
    sources: uniq([...a.sources, ...b.sources]),
    keyPoints: uniq([...a.keyPoints, ...b.keyPoints]),
  };
}

export async function runDynamicGeneration(
  topic: string,
  assembly: Assembly,
  opts: {
    maxRounds: number;
    organizeStyle?: string;
    maxResearch?: number;
    maxRewrite?: number;
    targetLength?: number; // 목표 글자수(공백 포함). 있으면 ±50자로 맞춤.
  },
  cb: OrchestratorCallbacks
): Promise<GenerationResult> {
  // 워커 실행 + 저장 헬퍼 (진행바 전진)
  const step = async <T>(
    stage: string,
    persona: string,
    fn: () => Promise<{ output: T; usage: LLMUsage | null }>
  ): Promise<T> => {
    const { output, usage } = await fn();
    await cb.persist(stage, persona, output, usage, true);
    return output;
  };

  // 1) 초기 리서치
  cb.progress("🔍 서치 모듈이 자료를 모으는 중...", "search");
  let search = await step("search", assembly.searchPersona, () => runSearch(topic, assembly.searchPersona));

  // 2) 초안
  cb.progress("📝 초안을 쓰는 중...", "generate");
  let draft = await step("generate", assembly.generatePersona, () =>
    runGenerate(topic, assembly.generatePersona, search)
  );

  // 3) 편집장 주도 개선 루프 (분기만 동적)
  const budget = {
    research: opts.maxResearch ?? 2,
    rewrite: opts.maxRewrite ?? 2,
  };
  const maxRounds = Math.max(0, opts.maxRounds);

  for (let round = 1; round <= maxRounds; round++) {
    // 비평
    cb.progress(`🎯 비평가 ${round}번이 초안을 살펴보는 중...`, "critic");
    const critique = await step<CriticResult>("critic", `critic-${round}`, () => runCritic(draft, round));

    if (critique.pass) {
      cb.progress("✅ 편집장: 비평 통과 — 이대로 마무리합니다.", "critic");
      break;
    }
    // 개선 예산이 모두 소진됐으면 종료
    if (budget.research <= 0 && budget.rewrite <= 0) break;

    // 편집장 결정 (동적 분기)
    const decision = await decideNextStep(topic, draft, critique, budget);
    await cb.persist(
      "director",
      "editor",
      { action: decision.action, reason: decision.reason, query: decision.query },
      decision.usage,
      false
    );

    if (decision.action === "finalize") {
      cb.progress(`🎬 편집장: ${decision.reason || "충분합니다"} — 마무리로 갑니다.`, "generate");
      break;
    }

    if (decision.action === "research") {
      budget.research--;
      cb.progress(`🎬 편집장 지시: 근거 보강 리서치 — "${decision.query || topic}"`, "search");
      const more = await step("search", assembly.searchPersona, () =>
        runSearch(decision.query || topic, assembly.searchPersona)
      );
      search = mergeSearch(search, more);
      cb.progress("✍️ 보강된 자료로 다시 쓰는 중...", "generate");
      draft = await step("generate", assembly.generatePersona, () =>
        runGenerate(topic, assembly.generatePersona, search, {
          previousDraft: draft,
          feedback: critique.feedback,
        })
      );
    } else {
      // rewrite
      budget.rewrite--;
      cb.progress("🎬 편집장 지시: 문장·구성을 다시 쓰는 중...", "generate");
      draft = await step("generate", assembly.generatePersona, () =>
        runGenerate(topic, assembly.generatePersona, search, {
          previousDraft: draft,
          feedback: critique.feedback,
        })
      );
    }
  }

  // 4) 정리 → 시각화 (마무리 뼈대)
  cb.progress("✨ 정리하는 중...", "organize");
  const organize = await step("organize", assembly.organizePersona, () =>
    runOrganize(assembly.organizePersona, draft, opts.organizeStyle)
  );

  cb.progress("📊 결과물로 시각화하는 중...", "visualize");
  let visualize = await step("visualize", assembly.visualizePersona, () =>
    runVisualize(assembly.visualizePersona, organize)
  );

  // 목표 글자수가 있으면 측정 → 교정 루프로 ±50자에 맞춘다.
  // (최종 글은 visualize에서 확정되므로, 실제로 화면/다운로드에 쓰이는 텍스트 기준으로 잰다.)
  const target = opts.targetLength;
  if (target && target > 0) {
    const measure = (v: typeof visualize) => countChars(extractArticleText({ visualize: v }));
    const before = measure(visualize);
    if (Math.abs(target - before) > 50) {
      cb.progress(`📏 목표 분량(${target}자)에 맞추는 중... (현재 ${before}자)`, "visualize");
      visualize = await fitToLength({
        target,
        tol: 50,
        maxTries: 3,
        initial: visualize,
        measure,
        revise: async (v, cur) => {
          const { output, usage } = await refitVisualize(assembly.visualizePersona, v, target, cur, 50);
          await cb.persist("visualize", assembly.visualizePersona, output, usage, false);
          return { value: output, usage };
        },
      });
    }
  }

  return { search, generate: draft, organize, visualize };
}
