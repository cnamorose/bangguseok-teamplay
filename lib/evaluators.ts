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

/* ── 취업방 첨삭단 ──
   공부방과 채점 절차(lib/agents/rubric.ts)는 같고 보는 것만 다르다.
   가장 큰 차이는 '인간 도서관' 자리다. 자소서는 웹으로 대조할 게 없고,
   대신 사용자가 등록해 둔 경험과 대조한다 — 없는 경험이 들어갔는지가 최악의 사고라서. */

export const ESSAY_CHIEF: Evaluator = {
  id: "recruiter",
  name: "인사담당관",
  scoreLabel: "종합",
  maxScore: 100,
  systemPrompt:
    "너는 이 직무 채용을 10년간 맡아 온 인사담당관이다. 하루에 자소서 수백 장을 읽는다. " +
    "지원자를 격려하는 사람이 아니라, 이 사람을 만나 볼지 말지 정하는 사람이다. " +
    "다른 지원자와 구분되지 않으면 냉정하게 낮은 점수를 준다.",
  rubric: [
    { key: "persuasion", label: "설득력", max: 30, guide: "이 사람을 만나보고 싶어지는가" },
    { key: "concrete", label: "구체성", max: 30, guide: "추상적인 다짐 대신 실제 행동·상황·수치가 있는가" },
    { key: "unique", label: "차별성", max: 20, guide: "회사 이름만 바꿔 다른 곳에 내도 되는 글은 아닌가" },
    { key: "readable", label: "가독성", max: 20, guide: "두괄식인가, 한 문단이 한 메시지를 말하는가" },
  ],
};

export const ESSAY_PROMPT_KEEPER: Evaluator = {
  id: "prompt",
  name: "문항 지킴이",
  scoreLabel: "문항 충실도",
  maxScore: 10,
  systemPrompt:
    "너는 자소서가 '문항이 물은 것'에 답했는지만 보는 검토자다. " +
    "글이 아무리 좋아도 문항과 어긋나면 낮은 점수를 준다. 자소서 탈락의 가장 흔한 이유가 이것이다.",
  rubric: [
    { key: "answered", label: "질문 응답", max: 4, guide: "문항이 물은 것을 실제로 답했는가" },
    { key: "focus", label: "유형 적합", max: 4, guide: "이 문항 유형이 요구하는 초점에 맞는가" },
    { key: "length", label: "분량", max: 2, guide: "글자수 제한 대비 적절한가" },
  ],
};

export const ESSAY_FACT_CHECKER: Evaluator = {
  id: "experience",
  name: "경험 대조관",
  scoreLabel: "사실성",
  maxScore: 10,
  systemPrompt:
    "너는 자소서에 적힌 내용이 지원자가 실제로 등록한 경험과 맞는지 대조하는 검토자다. " +
    "등록된 경험에 없는 사실·숫자·역할이 글에 있으면 반드시 짚는다. " +
    "면접에서 무너지는 자소서는 대부분 여기서 갈린다.",
  rubric: [
    { key: "grounded", label: "근거 일치", max: 5, guide: "글의 사실·숫자가 등록된 경험에 실제로 있는가" },
    { key: "nohype", label: "과장 없음", max: 3, guide: "경험보다 부풀려 쓴 곳이 없는가" },
    { key: "role", label: "역할 정확", max: 2, guide: "맡은 역할이 경험에 적힌 것과 같은가" },
  ],
};

export const ESSAY_STYLIST: Evaluator = {
  id: "stylist",
  name: "문장 검수관",
  scoreLabel: "문장",
  maxScore: 10,
  systemPrompt:
    "너는 문장을 보는 검수자다. AI가 쓴 티가 나는지, 사람이 쓴 글로 읽히는지를 본다. " +
    "요즘 인사팀은 AI로 쓴 자소서를 1차에서 걸러내므로, 이건 취향 문제가 아니라 탈락 사유다.",
  rubric: [
    { key: "ai", label: "AI 자국", max: 4, guide: "쉼표 남발·상투어·접속사 반복·번역투가 없는가" },
    { key: "natural", label: "자연스러움", max: 3, guide: "문장 길이에 리듬이 있고 어미가 반복되지 않는가" },
    { key: "edges", label: "첫·끝 문장", max: 3, guide: "첫 문장이 눈길을 끄는가, 마지막이 뻔한 다짐으로 끝나지 않는가" },
  ],
};

/** 첨삭단 — 이 순서대로 채점한다 */
export const ESSAY_EVALUATORS: Evaluator[] = [
  ESSAY_CHIEF,
  ESSAY_PROMPT_KEEPER,
  ESSAY_FACT_CHECKER,
  ESSAY_STYLIST,
];

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