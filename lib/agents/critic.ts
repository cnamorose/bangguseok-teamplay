import { callLLMJson, LLMUsage } from "@/lib/ai";
import { CRITIC_EVALUATOR_PROMPT } from "@/lib/personas";
import { GenerateOutput, CriticResult } from "@/lib/pipeline-types";

export async function runCritic(
  draft: GenerateOutput,
  round: number
): Promise<{ output: CriticResult; usage: LLMUsage }> {
  const userPrompt = `
아래는 초안이야. ${round}번째 검토야.

제목: ${draft.title}
본문:
${draft.content}

이 글을 평가하고, 아래 JSON 형식으로만 응답해. 다른 설명 붙이지 마.
{
  "pass": true 또는 false,
  "feedback": "재작성에 참고할 구체적인 개선 지시 (pass가 true면 빈 문자열)",
  "comment": "팀원에게 말하듯 한두 문장의 짧은 코멘트"
}
`.trim();

  const { data, usage } = await callLLMJson<CriticResult>({
    systemPrompt: CRITIC_EVALUATOR_PROMPT,
    userPrompt,
  });

  return { output: data, usage };
}