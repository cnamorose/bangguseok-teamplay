// 자소서 문항 유형.
//
// 문항마다 평가자가 확인하려는 게 다르다. 같은 경험이라도 지원동기에 쓸 때와
// 협업 문항에 쓸 때 강조점이 완전히 달라지므로, 유형별 지시를 따로 둔다.
// (한 프롬프트로 다 처리하면 어느 문항이든 비슷한 글이 나온다)

export type EssayKind =
  | "motivation"
  | "competency"
  | "growth"
  | "teamwork"
  | "failure"
  | "future"
  | "free";

export interface KindSpec {
  id: EssayKind;
  label: string;
  /** 평가자가 이 문항에서 확인하려는 것 */
  looksFor: string;
  /** 이 유형에만 붙는 구조 지시 */
  structure: string;
  /** 이 유형에서 특히 조심할 것 */
  avoid: string;
  /** 글자수 제한이 없을 때 쓸 기본 분량 */
  defaultChars: number;
}

export const KINDS: KindSpec[] = [
  {
    id: "motivation",
    label: "지원동기",
    looksFor: "이 회사를 선택한 진짜 이유와, 실제로 기여할 수 있다는 증거",
    structure: `
① 관심 계기 — 이 분야·직무에 끌린 구체적 순간
② 경험 연결 — 그 관심이 실제로 어떤 행동·경험으로 이어졌는지
③ 직무 적합성 — 그 경험에서 얻은 강점이 이 직무와 어떻게 맞닿는지
④ 미래 기여 — 입사 후 어떤 역할을 하고 싶은지 (구체적으로)
각 단계는 2~3문장. 회사 소개가 아니라 '내 이야기'가 중심이어야 한다.`.trim(),
    avoid: `
- 기업 칭찬으로 시작하거나 끝내지 마라. "비전에 감명받아", "업계 1위라서"는 금지.
- 회사 이름만 바꾸면 어디에나 쓸 수 있는 문장을 쓰지 마라.
- "입사하고 싶습니다"로 끝내지 말고, 구체적으로 무엇을 하고 싶은지로 끝내라.`.trim(),
    defaultChars: 600,
  },
  {
    id: "competency",
    label: "직무역량",
    looksFor: "이 직무를 실제로 수행할 수 있는가",
    structure: `
STAR 순서로 쓰되 행동(Action)에 가장 많은 분량을 준다.
① 상황 — 어떤 문제였는지 (2~3문장)
② 과제 — 내가 맡은 역할과 목표
③ 행동 — 구체적으로 무엇을 했는지. **왜 그 방법을 택했는지를 반드시 포함**
④ 결과 — 무엇이 달라졌는지, 마지막에 배운 점
마지막 문단에서 이 역량이 지원 직무와 어떻게 이어지는지 한 문단.`.trim(),
    avoid: `
- 행동을 뭉뚱그리지 마라. "노력했다", "최선을 다했다"는 아무 정보가 없다.
- 주어가 '우리 팀'이 되지 않게 하라. 이 사람이 한 일이어야 한다.`.trim(),
    defaultChars: 800,
  },
  {
    id: "growth",
    label: "성장과정",
    looksFor: "어떤 사람인가, 어떤 가치관을 가졌는가",
    structure: `
가치관 하나를 정하고, 그것을 보여주는 **에피소드 한 가지에만** 집중한다.
① 그 가치관이 만들어진 구체적 장면
② 그 장면에서 내가 한 선택
③ 그 선택이 지금의 나에게 남긴 것 — 지원 직무와 이어지게`.trim(),
    avoid: `
- 사건을 시간순으로 나열하지 마라. 연대기가 아니라 한 장면이다.
- "부산에서 3남매 중 막내로 태어나"처럼 정보 없는 출생·가족 소개로 시작하지 마라.`.trim(),
    defaultChars: 600,
  },
  {
    id: "teamwork",
    label: "협업 · 갈등",
    looksFor: "조직에서 함께 일할 수 있는가",
    structure: `
① 어떤 갈등·어려움이 있었는지 (짧게)
② 내가 취한 구체적인 커뮤니케이션 행동 — 여기에 분량을 몰아라
③ 그래서 어떻게 됐는지`.trim(),
    avoid: `
- 감정 묘사를 늘어놓지 마라. "속상했다", "답답했다"보다 무엇을 했는지가 중요하다.
- 상대를 탓하는 서술을 하지 마라.`.trim(),
    defaultChars: 600,
  },
  {
    id: "failure",
    label: "실패 · 극복",
    looksFor: "실패에서 무엇을 배웠고 실제로 무엇이 바뀌었는가",
    structure: `
① 무엇이 실패였는지 솔직하게
② 실패의 원인 중 **내가 통제할 수 있었던 부분**만
③ 마지막 문단에 이 경험 이후 실제로 바뀐 행동이나 습관을 구체적으로`.trim(),
    avoid: `
- 원인을 남이나 환경 탓으로 돌리지 마라.
- "값진 경험이었다"로 얼버무리지 마라. 무엇이 바뀌었는지가 없으면 실패담일 뿐이다.`.trim(),
    defaultChars: 600,
  },
  {
    id: "future",
    label: "입사 후 포부",
    looksFor: "장기 근속 가능성과 성장 방향",
    structure: `
① 1년 차 — 무엇을 익히고 어떤 일을 맡고 싶은지
② 3년 차 — 그때는 어떤 역할을 하고 있을지
③ 왜 이 회사에서 그게 가능한지 (회사의 사업·방향과 연결)
각 목표는 실행 가능한 계획이어야 한다.`.trim(),
    avoid: `
- 추상적인 다짐을 쓰지 마라. "최선을 다하겠습니다", "기여하겠습니다"는 아무 내용이 없다.
- 회사가 하지도 않는 사업을 하겠다고 하지 마라.`.trim(),
    defaultChars: 600,
  },
  {
    id: "free",
    label: "기타",
    looksFor: "문항이 실제로 묻는 것",
    structure: `
문항이 묻는 것을 그대로 답한다. 두괄식으로 결론을 먼저 말하고 근거를 편다.`.trim(),
    avoid: `
- 문항과 상관없는 자기소개를 붙이지 마라.`.trim(),
    defaultChars: 600,
  },
];

export function getKind(id: string): KindSpec {
  return KINDS.find((k) => k.id === id) ?? KINDS[KINDS.length - 1];
}

/** 문항 글에서 유형을 추측한다. 사용자가 고칠 수 있으므로 틀려도 된다 */
export function guessKind(prompt: string): EssayKind {
  const t = prompt.replace(/\s/g, "");
  if (/지원동기|지원한이유|왜.*지원|선택한이유/.test(t)) return "motivation";
  if (/입사후|포부|목표|이루고싶은/.test(t)) return "future";
  if (/성장과정|가치관|살아온|성장배경/.test(t)) return "growth";
  if (/협업|갈등|팀워크|함께|소통/.test(t)) return "teamwork";
  if (/실패|어려움|극복|좌절|힘들었던/.test(t)) return "failure";
  if (/역량|강점|직무|경험.*기술|잘할수있는/.test(t)) return "competency";
  return "free";
}
