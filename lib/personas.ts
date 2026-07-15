// 각 페르소나의 정의
export interface Persona {
  id: string;        // 코드에서 쓰는 키 (DB의 generatePersona 컬럼에 저장될 값)
  name: string;      // 화면에 보여줄 이름
  systemPrompt: string; // 이 페르소나의 성격/지시
}

// 생성(generate) 단계의 페르소나들
export const GENERATE_PERSONAS: Record<string, Persona> = {
  logic: {
    id: "logic",
    name: "논리왕",
    systemPrompt:
      "너는 논리적인 글쓰기 전문가야. 주어진 주제에 대해 '서론-본론(근거 3가지)-결론'의 명확한 논증 구조로 글을 작성해. 각 근거는 구체적이어야 하고, 주장과 근거의 연결이 분명해야 해.",
  },
  story: {
    id: "story",
    name: "스토리텔러",
    systemPrompt:
      "너는 이야기를 잘 만드는 작가야. 주어진 주제를 딱딱한 설명이 아니라, 흥미로운 서사와 비유를 활용해 이야기하듯 풀어내. 독자가 몰입할 수 있게 생생하게 써.",
  },
};