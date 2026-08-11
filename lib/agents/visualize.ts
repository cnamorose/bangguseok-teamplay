import { callLLMJson, LLMUsage } from "@/lib/ai";
import { VISUALIZE_PERSONAS } from "@/lib/personas";
import { OrganizeOutput, VisualizeOutput } from "@/lib/pipeline-types";
import { lengthInstruction } from "./length";

export async function runVisualize(
  personaId: string,
  organizeResult: OrganizeOutput
): Promise<{ output: VisualizeOutput; usage: LLMUsage }> {
  const persona = VISUALIZE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 시각화 페르소나: ${personaId}`);

  const baseContent = `
제목: ${organizeResult.title}
본문:
${organizeResult.content}
`.trim();

  let formatGuide = "";
  if (personaId === "slideMaker") {
    formatGuide = `"format"은 "slides"로 설정해.\n각 슬라이드를 하나의 section으로 만들고, content 배열의 각 원소는 짧은 불릿 문장이야.`;
  } else if (personaId === "alchemist") {
    formatGuide = `"format"은 "paper"로 설정해.\n서론/본론/결론 등을 각각 section으로 만들고, content 배열의 각 원소는 하나의 문단이야.`;
  } else {
    formatGuide = `"format"은 "report"로 설정해.\n개요/분석/제언 등을 각각 section으로 만들고, content 배열의 각 원소는 하나의 문단이야.`;
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

  const { data, usage } = await callLLMJson<VisualizeOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });

  return { output: data, usage };
}

// 이미 만들어진 시각화 결과의 '분량만' 목표에 맞게 다시 쓴다.
// (형식·제목·섹션 구성은 유지, 본문 길이만 조정 — 측정→교정 루프에서 호출)
export async function refitVisualize(
  personaId: string,
  current: VisualizeOutput,
  target: number,
  cur: number,
  tol: number
): Promise<{ output: VisualizeOutput; usage: LLMUsage }> {
  const persona = VISUALIZE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 시각화 페르소나: ${personaId}`);

  const userPrompt = `
아래는 이미 구성된 결과물(JSON)이야. format·title·각 섹션의 heading(구성)은 그대로 두고,
섹션 본문(content)의 분량만 목표 글자수에 맞게 다시 써줘.

[현재 결과물]
${JSON.stringify(current, null, 2)}

${lengthInstruction(cur, target, tol)}
(글자수는 title + 모든 섹션 heading·content를 공백 포함해 합산한 기준이다.)

아래 JSON 형식으로만 응답해. 다른 설명 붙이지 마.
{
  "format": "${current.format}",
  "title": "제목",
  "sections": [
    { "heading": "섹션 제목", "content": ["문단 또는 불릿", "..."] }
  ]
}
`.trim();

  const { data, usage } = await callLLMJson<VisualizeOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });

  return { output: data, usage };
}