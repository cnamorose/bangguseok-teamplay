import { callLLMJson } from "@/lib/ai";
import { GENERATE_PERSONAS } from "@/lib/personas";
import { GenerateOutput, SearchOutput } from "@/lib/pipeline-types";

export async function runGenerate(
  topic: string,
  personaId: string,
  searchResult: SearchOutput
): Promise<GenerateOutput> {
  const persona = GENERATE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 생성 페르소나: ${personaId}`);

  const userPrompt = `
주제: "${topic}"

아래는 조사된 핵심 포인트야. 이 내용에 근거해서만 글을 작성해. 없는 내용을 지어내지 마.

핵심 포인트:
${searchResult.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

아래 JSON 형식으로만 응답해줘. 다른 설명은 붙이지 마.

{
  "title": "글 제목",
  "content": "본문 내용"
}
`.trim();

  return callLLMJson<GenerateOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });
}