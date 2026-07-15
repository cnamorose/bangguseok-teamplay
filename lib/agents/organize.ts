import { callLLMJson } from "@/lib/ai";
import { ORGANIZE_PERSONAS } from "@/lib/personas";
import { GenerateOutput, OrganizeOutput } from "@/lib/pipeline-types";

export async function runOrganize(
  personaId: string,
  generateResult: GenerateOutput
): Promise<OrganizeOutput> {
  const persona = ORGANIZE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 정리 페르소나: ${personaId}`);

  const userPrompt = `
아래 글을 검토하고 다듬어줘.

제목: ${generateResult.title}
본문:
${generateResult.content}

아래 JSON 형식으로만 응답해줘. 다른 설명은 붙이지 마.

{
  "title": "다듬은 제목",
  "content": "불필요한 부분을 빼고 다듬은 본문",
  "feedback": "어떤 점을 수정했는지 한두 문장 코멘트"
}
`.trim();

  return callLLMJson<OrganizeOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });
}