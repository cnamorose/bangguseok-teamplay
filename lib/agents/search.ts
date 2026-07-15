import { callLLMJson } from "@/lib/ai";
import { SEARCH_PERSONAS } from "@/lib/personas";
import { SearchOutput } from "@/lib/pipeline-types";

export async function runSearch(
  topic: string,
  personaId: string
): Promise<SearchOutput> {
  const persona = SEARCH_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 서치 페르소나: ${personaId}`);

  const userPrompt = `
주제: "${topic}"

위 주제에 대해 조사해서, 아래 JSON 형식으로만 응답해줘. 다른 설명은 붙이지 마.

{
  "sources": ["참고한 관점이나 출처 유형 3~5개"],
  "keyPoints": ["핵심 포인트 5~7개, 각각 한 문장"]
}
`.trim();

  return callLLMJson<SearchOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });
}