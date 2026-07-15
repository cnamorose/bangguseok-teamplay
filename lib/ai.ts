import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// 기본 모델 (나중에 바꾸고 싶으면 여기만 수정)
const DEFAULT_MODEL = "gpt-4.1-nano";

interface CallLLMOptions {
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
}

export interface LLMUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number; // USD
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
}

// 모델별 가격 (USD per 1M tokens) — 나중에 모델 바뀌면 여기 수정
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  // 다른 모델 쓰면 여기 추가
};

/**
 * LLM 호출 (일시적 에러 시 자동 재시도)
 * 모든 에이전트 모듈이 이 함수를 통해 LLM을 부른다.
 * → provider나 모델을 바꿀 때 이 파일만 고치면 됨.
 */
export async function callLLM({
  systemPrompt,
  userPrompt,
  model = DEFAULT_MODEL,
}: CallLLMOptions): Promise<LLMResponse> {
  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
          { role: "user" as const, content: userPrompt },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";

      // 토큰 사용량 추출
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;

      // 비용 계산 (per 1M tokens)
      const price = PRICING[model] ?? { input: 0, output: 0 };
      const cost =
        (inputTokens / 1_000_000) * price.input +
        (outputTokens / 1_000_000) * price.output;

      return { text, usage: { model, inputTokens, outputTokens, cost } };
    } catch (error) {
      const message = String(error);
      const isRetryable =
        message.includes("429") || message.includes("500") ||
        message.includes("502") || message.includes("503") ||
        message.includes("overloaded") || message.includes("rate limit");

      if (!isRetryable || attempt === maxRetries) throw error;

      const waitMs = 1000 * Math.pow(2, attempt - 1);
      console.log(`LLM 호출 실패(${attempt}/${maxRetries}), ${waitMs}ms 후 재시도...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error("LLM 호출 최대 재시도 초과");
}

/**
 * LLM에게 JSON 형식으로 응답받는 함수.
 * (내부적으로 callLLM을 쓰므로 재시도도 자동 적용)
 */
export async function callLLMJson<T>({
  systemPrompt,
  userPrompt,
  model = DEFAULT_MODEL,
}: CallLLMOptions): Promise<{ data: T; usage: LLMUsage }> {
  const { text, usage } = await callLLM({ systemPrompt, userPrompt, model });

  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return { data: JSON.parse(cleaned) as T, usage };
  } catch (error) {
    console.error("JSON 파싱 실패. 원본 응답:", text);
    throw new Error("LLM이 올바른 JSON을 반환하지 않았습니다.");
  }
}