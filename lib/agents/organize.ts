import { callLLMJson, LLMUsage } from "@/lib/ai";
import { ORGANIZE_PERSONAS } from "@/lib/personas";
import { GenerateOutput, OrganizeOutput } from "@/lib/pipeline-types";

const STYLE_GUIDE: Record<string, string> = {
  plain: "모든 문장을 '~한다', '~했다' 같은 평서체(한다체)로 통일해.",
  formal: "모든 문장을 '~합니다', '~습니다' 같은 합쇼체 높임말로 통일해.",
  soft: "모든 문장을 '~해요' 같은 해요체로 부드럽게 통일해.",
};

export async function runOrganize(
  personaId: string,
  generateResult: GenerateOutput,
  style?: string
): Promise<{ output: OrganizeOutput; usage: LLMUsage }> {
  const persona = ORGANIZE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 정리 페르소나: ${personaId}`);

  const styleInstruction =
    personaId === "proofreader" && style && STYLE_GUIDE[style]
      ? `\n\n문체 지시: ${STYLE_GUIDE[style]}`
      : "";

  const userPrompt = `
아래 글을 검토하고 다듬어줘.

제목: ${generateResult.title}
본문:
${generateResult.content}
${styleInstruction}

아래 JSON 형식으로만 응답해줘. 다른 설명은 붙이지 마.
{
  "title": "다듬은 제목",
  "content": "다듬은 본문",
  "feedback": "어떤 점을 손봤는지 한두 문장 코멘트"
}
`.trim();

  const { data, usage } = await callLLMJson<OrganizeOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });

  return { output: data, usage };
}