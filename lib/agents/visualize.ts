import { callLLMJson } from "@/lib/ai";
import { VISUALIZE_PERSONAS } from "@/lib/personas";
import { OrganizeOutput, VisualizeOutput } from "@/lib/pipeline-types";

export async function runVisualize(
  personaId: string,
  organizeResult: OrganizeOutput
): Promise<VisualizeOutput> {
  const persona = VISUALIZE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 시각화 페르소나: ${personaId}`);

  const baseContent = `
제목: ${organizeResult.title}
본문:
${organizeResult.content}
`.trim();

  // 페르소나별로 어떤 형식/구조로 만들지 지시 (출력 JSON 구조는 동일)
  let formatGuide = "";
  if (personaId === "slideMaker") {
    formatGuide = `
"format"은 "slides"로 설정해.
각 슬라이드를 하나의 section으로 만들고, content 배열의 각 원소는 짧은 불릿 문장이야.
`.trim();
  } else if (personaId === "alchemist") {
    formatGuide = `
"format"은 "paper"로 설정해.
서론/본론/결론 등을 각각 section으로 만들고, content 배열의 각 원소는 하나의 문단이야.
`.trim();
  } else {
    // 기본: 보고서 (인간 타자기)
    formatGuide = `
"format"은 "report"로 설정해.
개요/분석/제언 등을 각각 section으로 만들고, content 배열의 각 원소는 하나의 문단이야.
`.trim();
  }

  const userPrompt = `
아래 글을 재구성해줘.

${baseContent}

${formatGuide}

아래 JSON 형식으로만 응답해. 다른 설명은 붙이지 마.
{
  "format": "report | slides | paper 중 하나",
  "title": "제목",
  "sections": [
    { "heading": "섹션(또는 슬라이드) 제목", "content": ["문단 또는 불릿", "..."] }
  ]
}
`.trim();

  return callLLMJson<VisualizeOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });
}