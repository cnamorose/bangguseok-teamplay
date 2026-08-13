import { callLLMJson, LLMUsage } from "@/lib/ai";
import { CompanyAnalysis, RoleAnalysis } from "./types";

// 공고 분석.
//
// 채용공고는 '회사의 방향이 사람 요구로 번역된 문서'다.
// 그래서 공고만 요약하면 자격요건 나열에 그치고, 회사 분석과 겹쳐야
// "이 공고가 왜 이렇게 생겼는지"가 나온다. 그게 지원동기의 재료다.
//
// 원문이 있으면 검색하지 않는다. 추측한 자격요건보다 공고 원문이 언제나 정확하다.

const SYSTEM =
  "너는 채용공고를 읽고 지원자에게 필요한 것만 뽑아 주는 취업 컨설턴트다. " +
  "공고에 적힌 것만 옮기고, 없는 조건이나 날짜를 지어내지 않는다.";

export interface PostingResult {
  /** 공고에서 읽어낸 직무명 (사용자가 적은 것보다 정확하면 이걸 쓴다) */
  role: string;
  /** 마감일 YYYY-MM-DD. 공고에 없거나 '상시'면 빈 문자열 */
  deadline: string;
  analysis: RoleAnalysis;
}

export async function analyzePosting(
  companyName: string,
  posting: string,
  fallbackRole: string,
  company?: CompanyAnalysis | null
): Promise<{ result: PostingResult; usage: LLMUsage }> {
  const companyContext = company
    ? `
[이미 파악한 회사의 방향]
- 지금 ${company.headline.cause} 때문에 ${company.headline.direction}을 강화하는 중
- 변화: ${company.shift?.conclusion ?? ""}
- 핵심 키워드: ${(company.headline.keywords ?? []).join(", ")}`.trim()
    : "[회사 분석 자료 없음 — 공고 내용만으로 정리해라]";

  const userPrompt = `
"${companyName}"의 채용공고다. 지원자가 자기소개서를 쓰기 전에 알아야 할 것만 뽑아라.

${companyContext}

[채용공고 원문]
${posting}

[규칙]
- 공고에 적힌 것만 옮겨라. 없는 자격요건·날짜를 지어내지 마라.
- requirements는 공고의 자격요건·우대사항을 **원문 표현 그대로** 4~8개.
  요약해서 뭉개지 말고, 기술·도구 이름은 그대로 살려라.
- deadline은 공고에 적힌 마감일을 YYYY-MM-DD로. 상시채용이거나 없으면 빈 문자열.
- role은 공고의 모집 직무명. 못 찾으면 "${fallbackRole}"을 그대로 써라.

[whyThisRole — 여기가 이 분석의 핵심이다]
공고의 요구사항과 회사의 방향을 겹쳐서, **이 회사가 왜 지금 이런 사람을 찾는지**를 2~3문장으로 설명해라.
자격요건을 다시 나열하지 마라. 그건 requirements에 이미 있다.
  나쁨: "대규모 트래픽 경험과 분산처리 역량을 요구합니다"
  좋음: "커머스에서 AI 인프라로 옮겨가는 중이라, 이 자리는 그 전환을 실제로 감당할 사람을 찾는 자리입니다"
회사 분석 자료가 없으면 공고에서 드러나는 방향만으로 쓰고, 억지로 지어내지 마라.

[checkpoints]
이 공고에 맞춰 자기소개서에서 반드시 짚어야 할 것 3개.

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{
  "role": "모집 직무명",
  "deadline": "YYYY-MM-DD 또는 빈 문자열",
  "requirements": ["공고 원문 표현 그대로"],
  "whyThisRole": "2~3문장",
  "checkpoints": ["...", "...", "..."]
}
`.trim();

  const { data, usage } = await callLLMJson<{
    role: string;
    deadline: string;
    requirements: string[];
    whyThisRole: string;
    checkpoints: string[];
  }>({ systemPrompt: SYSTEM, userPrompt });

  const role = data.role?.trim() || fallbackRole;

  return {
    result: {
      role,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(data.deadline ?? "") ? data.deadline : "",
      analysis: {
        role,
        requirements: Array.isArray(data.requirements) ? data.requirements.slice(0, 8) : [],
        linkToStrategy: data.whyThisRole ?? "",
        checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints.slice(0, 3) : [],
        sources: [], // 공고 원문이 곧 출처라 따로 없다
        asOf: new Date().toISOString().slice(0, 10),
      },
    },
    usage,
  };
}
