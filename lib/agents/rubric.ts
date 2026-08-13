import { callLLMJson, LLMUsage } from "@/lib/ai";
import { RubricItem } from "@/lib/evaluators";
import { ScoreBreakdown } from "@/lib/pipeline-types";

// 항목별 채점.
//
// 공부방 평가단과 취업방 첨삭단이 같이 쓴다.
// 무엇을 평가하느냐(taskPrompt)와 어떤 기준으로 매기느냐(rubric)만 다르고,
// "항목마다 점수를 받아 합산한다"는 절차는 같다.

export interface RubricScore {
  total: number;
  breakdown: ScoreBreakdown[];
  comment: string;
  usage: LLMUsage;
}

/**
 * taskPrompt는 "평가할 글 제시 + 무엇을 볼지"까지만 담는다.
 * 채점 규칙과 응답 형식은 여기서 붙인다.
 */
export async function scoreByRubric(opts: {
  systemPrompt: string;
  taskPrompt: string;
  rubric: RubricItem[];
}): Promise<RubricScore> {
  const { systemPrompt, taskPrompt, rubric } = opts;

  const itemsText = rubric
    .map((i) => `- ${i.key} (${i.label}, ${i.max}점 만점): ${i.guide}`)
    .join("\n");
  const scoreKeys = rubric.map((i) => `"${i.key}": 0~${i.max} 사이 정수`).join(", ");

  const userPrompt = `
${taskPrompt}

[채점 항목] 각 항목을 만점 기준으로 냉정하게 채점해. 후하게 주지 말고, 결점이 있으면 과감히 낮게 줘.
${itemsText}

[점수 감각] 각 항목에서 만점의 85% 이상 = 뛰어남, 60~85% = 준수, 40~60% = 보통, 40% 미만 = 미흡.
근거가 약하거나 확인되지 않으면 낮은 구간을 줘. 좋은 점만 보지 말고 약점을 반드시 반영해.

아래 JSON 형식으로만 응답해. 다른 설명 붙이지 마.
{
  "scores": { ${scoreKeys} },
  "comment": "총평 — 강점과 약점을 균형있게 (2~3문장)"
}
`.trim();

  const { data, usage } = await callLLMJson<{ scores: Record<string, number>; comment: string }>({
    systemPrompt,
    userPrompt,
  });

  // 범위 밖·누락 방어
  const breakdown: ScoreBreakdown[] = rubric.map((i) => {
    const raw = Number(data.scores?.[i.key]);
    const score = Math.max(0, Math.min(i.max, Number.isFinite(raw) ? Math.round(raw) : 0));
    return { label: i.label, score, maxScore: i.max };
  });
  const total = breakdown.reduce((sum, b) => sum + b.score, 0);

  return { total, breakdown, comment: data.comment ?? "", usage };
}
