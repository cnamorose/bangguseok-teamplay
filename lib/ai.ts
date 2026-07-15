import { GoogleGenAI } from "@google/genai";

// Gemini 클라이언트 (한 번만 생성)
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY! });

// 기본 모델 ( 나중에 모듈마다 바꾸고 싶으면 인자로 넘기면 됨)
const DEFAULT_MODEL = "gemini-3.5-flash";

interface CallLLMOptions {
  systemPrompt?: string; // 페르소나/역할 지시
  userPrompt: string;    // 실제 요청 내용
  model?: string;        // 모델 교체용 (기본값 있음)
}

/**
 * LLM 호출 (503/429 같은 일시적 에러 시 자동 재시도)
 */
export async function callLLM({
  systemPrompt,
  userPrompt,
  model = DEFAULT_MODEL,
}: CallLLMOptions): Promise<string> {
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${userPrompt}`
    : userPrompt;

  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
      });
      return response.text ?? "";
    } catch (error) {
      const message = String(error);
      const isRetryable =
        message.includes("503") ||
        message.includes("429") ||
        message.includes("UNAVAILABLE") ||
        message.includes("overloaded");

      // 재시도 불가능한 에러거나, 마지막 시도였으면 그냥 던짐
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // 기다렸다 재시도 (1초 → 2초 → 4초로 점점 늘림)
      const waitMs = 1000 * Math.pow(2, attempt - 1);
      console.log(`LLM 호출 실패(${attempt}/${maxRetries}), ${waitMs}ms 후 재시도...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error("LLM 호출 최대 재시도 초과");
}

/**
 * LLM에게 JSON 형식으로 응답을 받는 함수.
 * 프롬프트로 JSON을 지시하고, 응답을 파싱해서 객체로 반환한다.
 * 모델이 코드블록(```json)으로 감싸는 경우도 자동 처리.
 */
export async function callLLMJson<T>({
  systemPrompt,
  userPrompt,
  model = DEFAULT_MODEL,
}: CallLLMOptions): Promise<T> {
  const raw = await callLLM({ systemPrompt, userPrompt, model });

  // LLM이 ```json ... ``` 으로 감싸는 경우가 흔해서 벗겨냄
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("JSON 파싱 실패. 원본 응답:", raw);
    throw new Error("LLM이 올바른 JSON을 반환하지 않았습니다.");
  }
}