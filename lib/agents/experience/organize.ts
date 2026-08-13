import { callLLMJson, LLMUsage } from "@/lib/ai";

// 정리 도우미.
// 막 적은 글을 항목별로 나누고, 키워드를 뽑고, 무엇이 부족한지 질문으로 돌려준다.
//
// 이 기능의 값은 '구조화'보다 '되묻기'에 있다.
// 자소서에서 걸리는 건 대개 세 가지인데, 셋 다 경험을 적는 시점에 잡아야
// 나중에 기억을 되짚지 않는다.
//   ① 주어가 '우리'라 내가 한 일이 안 보인다
//   ② 왜 그렇게 했는지가 없다 (차별화가 여기서 생긴다)
//   ③ 결과가 비교 불가능한 표현이다 ("빨라짐")

export interface Gap {
  field: string;    // 어느 칸 얘기인지 (impact, action, ...)
  issue: string;    // 뭐가 부족한지
  question: string; // 사용자가 바로 답할 수 있는 형태의 질문
  /**
   * 어떤 종류의 지적인지. 정리 단계에선 대개 비어 있고(=부족함),
   * 점검 단계(check.ts)에서 칸이 뒤섞였는지까지 가려낸다.
   */
  kind?: "missing" | "misplaced" | "vague" | "subject";
}

export interface OrganizedExperience {
  title: string;
  period: string;
  role: string;
  situation: string;
  action: string;
  impact: string;
  learning: string;
  message: string;
  tags: string[];
  gaps: Gap[];
}

const SYSTEM =
  "너는 취업 준비생의 경험을 자기소개서에 쓸 수 있게 정리해 주는 사람이다. " +
  "적힌 내용만 가지고 정리하고, 없는 사실은 절대 지어내지 않는다. " +
  "모르는 칸은 비워 두고, 대신 무엇을 물어봐야 채울 수 있는지 알려준다.";

export async function organizeExperience(
  raw: string
): Promise<{ data: OrganizedExperience; usage: LLMUsage }> {
  const userPrompt = `
아래는 어떤 사람이 자기 경험을 떠오르는 대로 적은 글이다.
자기소개서에 쓸 수 있게 항목별로 정리해라.

[적은 글]
${raw}

[STAR로 나눈다 — 각 칸에 무엇이 들어가는지]
- period = 언제. "2025년 2학기", "2025.03~08"처럼 시기를 알 수 있게.
- role (T·과제) = 이 사람이 맡은 자리와 목표.
  "4인 팀에서 백엔드 담당", "행사 예산 관리를 맡음"처럼 무엇을 책임졌는지가 보여야 한다.
  "참여", "팀원"처럼 무엇을 했는지 모르는 표현은 쓰지 마라.
- situation (S·상황) = 어디서, 어떤 문제였나.
  규모와 맥락을 함께. "4인 팀 프로젝트에서 페이지 로딩이 3초를 넘어 이탈이 잦았다"
- action (A·행동) = 이 사람이 구체적으로 무엇을 했나. **여기가 가장 중요하다.**
  · 쓴 도구·방법의 이름을 그대로 살려라 (Figma, Slack, K-NN, 카드뉴스 등)
  · 왜 그 방법을 골랐는지가 글에 있으면 반드시 남겨라
  · **해보다 안 됐던 시도가 있으면 그것도 남겨라.** 실패한 시도는 진짜 경험이라는 증거다
  · 주어가 '우리·팀'이면 안 된다. 이 사람이 직접 한 것만.
- impact (R·결과) = 그래서 무엇이 달라졌나.
  글에 숫자가 있으면 **반드시 그대로 살려라** ("3초→0.8초", "방문자 200명", "40% 단축").
  숫자가 없으면 지어내지 말고, 전후 대비로 쓰거나 비워 두고 gaps에서 물어라.

[정리 규칙]
- 글에 있는 내용만 써라. 없는 사실·숫자·성과를 지어내지 마라.
- 근거가 없는 칸은 빈 문자열로 둬라. 억지로 채우는 것보다 비어 있는 게 낫다.
- message는 이 경험이 남에게 보여주는 이 사람의 모습을 한 줄로. (배운 점과는 다르다)
  예: "데이터로 원인을 찾아내는 사람", "갈등을 먼저 꺼내 조율하는 사람"
- tags는 직무·역량 키워드 3~5개. (예: 협업, 문제해결, 데이터분석, 리더십)

[부족한 점 찾기]
자기소개서로 쓰기에 부족한 곳을 최대 3개까지 짚어라. 우선순위는 이 순서다.
1. 결과가 비교 불가능하다 — "빨라졌다", "좋아졌다"처럼 전후를 알 수 없는 표현
2. 주어가 '우리·팀'이라 이 사람이 뭘 했는지 안 보인다
3. 왜 그 방법을 택했는지가 없다

question은 **그 사람이 바로 답할 수 있는 구체적인 질문**으로 써라.
  나쁨: "성과가 부족합니다"
  좋음: "로딩이 몇 초에서 몇 초로 줄었나요?"
숫자를 요구하지 마라. 숫자가 없으면 "전에는 어땠나요?"처럼 대비를 물어라.

아래 JSON으로만 응답해. 다른 설명 붙이지 마.
{
  "title": "경험 이름 (20자 이내)",
  "period": "언제. 글에 없으면 빈 문자열",
  "role": "맡은 자리와 목표 (T)",
  "situation": "어디서, 어떤 문제였나 — 규모와 맥락 포함 (S, 1~2문장)",
  "action": "구체적으로 한 일 — 도구·방법 이름, 왜 그렇게 했는지, 실패한 시도까지 (A, 2~4문장)",
  "impact": "무엇이 달라졌나 — 숫자가 있으면 그대로 (R, 1~2문장). 근거 없으면 빈 문자열",
  "learning": "배운 점 (한 문장)",
  "message": "이 경험이 말하는 한 가지 (한 줄)",
  "tags": ["키워드 3~5개"],
  "gaps": [{ "field": "impact", "issue": "무엇이 부족한지", "question": "바로 답할 수 있는 질문" }]
}
`.trim();

  const { data, usage } = await callLLMJson<Partial<OrganizedExperience>>({
    systemPrompt: SYSTEM,
    userPrompt,
  });

  return {
    data: {
      title: data.title?.trim() || "제목 없는 경험",
      period: data.period ?? "",
      role: data.role ?? "",
      situation: data.situation ?? "",
      action: data.action ?? "",
      impact: data.impact ?? "",
      learning: data.learning ?? "",
      message: data.message ?? "",
      tags: Array.isArray(data.tags) ? data.tags.slice(0, 6) : [],
      gaps: Array.isArray(data.gaps) ? data.gaps.slice(0, 3) : [],
    },
    usage,
  };
}
