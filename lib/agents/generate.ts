import { callLLMJson, LLMUsage } from "@/lib/ai";
import { GENERATE_PERSONAS } from "@/lib/personas";
import { GenerateOutput, SearchOutput } from "@/lib/pipeline-types";

export async function runGenerate(
  topic: string,
  personaId: string,
  searchResult: SearchOutput,
  revision?: { previousDraft: GenerateOutput; feedback: string }
): Promise<{ output: GenerateOutput; usage: LLMUsage }> {
  const persona = GENERATE_PERSONAS[personaId];
  if (!persona) throw new Error(`알 수 없는 생성 페르소나: ${personaId}`);

  const keyPointsText = searchResult.keyPoints
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  let userPrompt: string;

  if (revision) {
    userPrompt = `
주제: "${topic}"

아래는 네가 이전에 쓴 초안인데, 비평가가 피드백을 줬어.
피드백을 반영해서 글을 다시 써줘.

[이전 초안]
제목: ${revision.previousDraft.title}
본문:
${revision.previousDraft.content}

[비평가 피드백]
${revision.feedback}

[참고 자료 - 핵심 포인트]
${keyPointsText}

위 자료에 근거하되, 피드백을 반영해 개선된 글을 아래 JSON 형식으로만 응답해. 다른 설명 붙이지 마.
{
  "title": "글 제목",
  "content": "개선된 본문"
}
`.trim();
  } else {
    userPrompt = `
주제: "${topic}"

아래는 조사된 핵심 포인트야. 이 내용에 근거해서만 글을 작성해. 없는 내용을 지어내지 마.

핵심 포인트:
${keyPointsText}

아래 JSON 형식으로만 응답해줘. 다른 설명은 붙이지 마.
{
  "title": "글 제목",
  "content": "본문 내용"
}
`.trim();
  }

  const { data, usage } = await callLLMJson<GenerateOutput>({
    systemPrompt: persona.systemPrompt,
    userPrompt,
  });

  return { output: data, usage };
}