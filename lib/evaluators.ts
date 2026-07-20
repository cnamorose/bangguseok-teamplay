// 평가단 정의 (이름/프롬프트를 여기서 관리 → 바꾸기 쉬움)

// 채점 기준표(rubric) 한 항목
export interface RubricItem {
  key: string;    // LLM JSON 응답 키
  label: string;  // 화면 표시명
  max: number;    // 이 항목 만점
  guide: string;  // 무엇을 보는지 (프롬프트에 들어감)
}

export interface Evaluator {
  id: string;
  name: string;
  scoreLabel: string;   // 점수 항목 이름
  maxScore: number;     // 만점 (= rubric max 합)
  systemPrompt: string;
  rubric: RubricItem[]; // 세부 채점 항목
}

export const CHIEF_EVALUATOR: Evaluator = {
  id: "chief",
  name: "평가원",
  scoreLabel: "종합",
  maxScore: 100,
  systemPrompt:
    "너는 글을 전반적으로 평가하는 총괄 심사위원이야. 논리, 구성, 표현, 설득력을 두루 살펴 전체적인 인상과 완성도를 종합적으로 평가해. 균형 잡힌 시각으로 강점과 약점을 짚어줘.",
  rubric: [
    { key: "logic", label: "논리성", max: 25, guide: "주장과 근거의 연결이 탄탄한지, 비약·모순이 없는지" },
    { key: "structure", label: "구성", max: 25, guide: "서론-본론-결론의 흐름과 문단 배치가 자연스러운지" },
    { key: "expression", label: "표현력", max: 25, guide: "문장이 명료하고 군더더기가 없는지" },
    { key: "persuasion", label: "설득력", max: 25, guide: "독자를 설득하는 힘과 임팩트가 있는지" },
  ],
};

export const SEARCH_EVALUATOR: Evaluator = {
  id: "librarian",
  name: "인간 도서관",
  scoreLabel: "사실성",
  maxScore: 10,
  systemPrompt:
    "너는 사실 검증 전문가야. 글에 담긴 주장·통계·사례가 실제 자료로 뒷받침되는지 검증해. 제공된 검색 자료와 대조해서, 근거가 확실한 것과 확인되지 않는 것을 구분하고 사실성을 평가해.",
  rubric: [
    { key: "support", label: "근거 뒷받침", max: 5, guide: "핵심 주장이 검색 자료로 실제 뒷받침되는 정도" },
    { key: "accuracy", label: "정확성", max: 3, guide: "사실 오류·과장·왜곡이 없는지" },
    { key: "verifiability", label: "검증가능성", max: 2, guide: "주장이 구체적이고 확인 가능한 형태인지" },
  ],
};

export const ORGANIZE_EVALUATOR: Evaluator = {
  id: "wordsmith",
  name: "글조합 천재",
  scoreLabel: "정교함",
  maxScore: 10,
  systemPrompt:
    "너는 문장과 글 구성 전문가야. 문법, 표현, 문장의 매끄러움, 글의 구성과 흐름을 평가해. 어색한 부분과 개선점을 구체적으로 짚어줘.",
  rubric: [
    { key: "grammar", label: "문법·정확성", max: 3, guide: "맞춤법·문법·비문이 없는지" },
    { key: "expression", label: "표현·자연스러움", max: 4, guide: "문장이 매끄럽고 어휘가 적절한지" },
    { key: "flow", label: "구성·흐름", max: 3, guide: "문단 연결과 전체 흐름이 매끄러운지" },
  ],
};