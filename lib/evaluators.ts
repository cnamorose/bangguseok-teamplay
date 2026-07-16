// 평가단 정의 (이름/프롬프트를 여기서 관리 → 바꾸기 쉬움)

export interface Evaluator {
  id: string;
  name: string;
  scoreLabel: string;   // 점수 항목 이름
  maxScore: number;     // 만점
  systemPrompt: string;
}

export const CHIEF_EVALUATOR: Evaluator = {
  id: "chief",
  name: "평가원",
  scoreLabel: "종합",
  maxScore: 100,
  systemPrompt:
    "너는 글을 전반적으로 평가하는 총괄 심사위원이야. 논리, 구성, 표현, 설득력을 두루 살펴 전체적인 인상과 완성도를 종합적으로 평가해. 균형 잡힌 시각으로 강점과 약점을 짚어줘.",
};

export const SEARCH_EVALUATOR: Evaluator = {
  id: "librarian",
  name: "인간 도서관",
  scoreLabel: "사실성",
  maxScore: 10,
  systemPrompt:
    "너는 사실 검증 전문가야. 글에 담긴 주장·통계·사례가 실제 자료로 뒷받침되는지 검증해. 제공된 검색 자료와 대조해서, 근거가 확실한 것과 확인되지 않는 것을 구분하고 사실성을 평가해.",
};

export const ORGANIZE_EVALUATOR: Evaluator = {
  id: "wordsmith",
  name: "글조합 천재",
  scoreLabel: "정교함",
  maxScore: 10,
  systemPrompt:
    "너는 문장과 글 구성 전문가야. 문법, 표현, 문장의 매끄러움, 글의 구성과 흐름을 평가해. 어색한 부분과 개선점을 구체적으로 짚어줘.",
};