// 면접관.
//
// 취업방에서 '조립'이 자연스러운 유일한 자리다. 실제 면접도 누가 들어오느냐로
// 완전히 달라지므로, 팀을 꾸리는 게 억지가 아니라 현실을 반영한다.

export interface Interviewer {
  id: string;
  name: string;
  emoji: string;
  /** 화면에 보여줄 한 줄 */
  role: string;
  /** 이 면접관이 무엇을 파는지 */
  focus: string;
  /** 꼬리질문을 얼마나 다는 편인지 — 질문 배분에 쓴다 */
  persistence: "high" | "normal";
}

export const INTERVIEWERS: Interviewer[] = [
  {
    id: "pressure",
    name: "압박 면접관",
    emoji: "😠",
    role: "근거를 끝까지 판다",
    focus: `
답변의 근거가 약한 곳을 놓치지 않는다. "왜 그렇게 판단했는지", "다른 방법은 없었는지",
"그 숫자는 어떻게 측정했는지"를 파고든다. 답이 두루뭉술하면 같은 것을 다시 묻는다.
무례하지는 않되 물러서지 않는다.`.trim(),
    persistence: "high",
  },
  {
    id: "culture",
    name: "인성 면접관",
    emoji: "🤝",
    role: "함께 일할 사람인지 본다",
    focus: `
갈등이 있었을 때 어떻게 했는지, 어떤 가치를 우선하는지, 팀에서 어떤 역할을 하는지 본다.
추상적인 다짐이 아니라 실제로 한 행동을 묻는다.`.trim(),
    persistence: "normal",
  },
  {
    id: "tech",
    name: "직무 면접관",
    emoji: "🔧",
    role: "실제로 할 수 있는지 본다",
    focus: `
지원 직무의 요구 역량을 기준으로 판다. 경험에서 쓴 도구·방법의 선택 이유,
막혔을 때 어떻게 풀었는지, 실패한 시도가 있었는지를 구체적으로 묻는다.`.trim(),
    persistence: "high",
  },
  {
    id: "exec",
    name: "임원 면접관",
    emoji: "👔",
    role: "회사와 이어지는지 본다",
    focus: `
왜 이 회사인지, 회사가 가는 방향과 이 사람이 어떻게 맞물리는지, 몇 년 뒤 무엇을 하고 싶은지 본다.
세부 기술보다 큰 그림과 태도를 묻는다.`.trim(),
    persistence: "normal",
  },
];

export function getInterviewer(id: string): Interviewer {
  return INTERVIEWERS.find((i) => i.id === id) ?? INTERVIEWERS[0];
}

/** 한국어 말하기 속도는 분당 330자쯤. 글자수를 말했을 때의 초로 환산한다 */
export function speakSeconds(text: string): number {
  return Math.round((Array.from(text).length / 330) * 60);
}
