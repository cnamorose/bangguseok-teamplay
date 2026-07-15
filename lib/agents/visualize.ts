import { callLLMJson } from "@/lib/ai";
import { VISUALIZE_PERSONAS } from "@/lib/personas";
import { OrganizeOutput, VisualizeOutput } from "@/lib/pipeline-types";

export async function runVisualize(
  personaId: string,
  organizeResult: OrganizeOutput
): Promise<VisualizeOutput> {
  const persona = VISUALIZE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 시각화 페르소나: ${personaId}`);

  const userPrompt = `
아래 글을 발표 슬라이드 아웃라인으로 만들어줘.

제목: ${organizeResult.title}
본문:
${organizeResult.content}

아래 JSON 형식으로만 응답해줘. 다른 설명은 붙이지 마.

{
  "slides": [
    { "heading": "슬라이드 제목", "bullets": ["요점1", "요점2"] }
  ]
}
`.trim();

  return callLLMJson<VisualizeOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });
}