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
 * LLM을 호출하는 공용 함수.
 * 모든 에이전트 모듈이 이 함수를 통해 LLM을 부른다.
 * → 나중에 모델을 바꾸거나 provider를 교체할 때 여기만 고치면 됨.
 */

export async function callLLM({
  systemPrompt,
  userPrompt,
  model = DEFAULT_MODEL,
}: CallLLMOptions): Promise<string> {
  // systemPrompt가 있으면 앞에 붙여서 역할을 지시
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${userPrompt}`
    : userPrompt;

  const response = await ai.models.generateContent({
    model,
    contents: fullPrompt,
  });

  return response.text ?? "";
}