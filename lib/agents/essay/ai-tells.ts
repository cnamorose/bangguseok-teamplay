// AI 티 검증기.
//
// 인사팀이 1차로 거른다는 그 특징들을 코드로 센다.
// LLM한테 "AI 같니?"라고 물어볼 일이 아니다 — 쉼표 개수나 문장 길이 편차는
// 세면 나오는 값이고, 세는 쪽이 훨씬 정확하고 공짜다.
//
// 다만 규칙 기반이라 오탐이 있다. 그래서 '틀렸다'가 아니라 '이런 자국이 보인다'로 보여준다.

/** 사람은 잘 안 쓰는데 LLM은 즐겨 쓰는 표현 */
export const AI_PHRASES: { phrase: string; instead: string }[] = [
  { phrase: "에 그치지 않고", instead: "거기서 멈추지 않았습니다" },
  { phrase: "단순히", instead: "빼거나 구체적인 말로" },
  { phrase: "을 넘어서", instead: "범위를 넓혔습니다" },
  { phrase: "를 넘어서", instead: "범위를 넓혔습니다" },
  { phrase: "예를 들어", instead: "~시점에 이런 상황이 있었습니다" },
  { phrase: "체득", instead: "배웠습니다 · 겪었습니다" },
  { phrase: "익혔습니다", instead: "배웠습니다 · 쌓았습니다" },
  { phrase: "실질적으로", instead: "빼도 뜻이 통합니다" },
  { phrase: "맞닿아", instead: "제 경험과 연결할 수 있었습니다" },
  { phrase: "유관부서", instead: "생산팀·품질팀처럼 이름을 밝히기" },
  { phrase: "다양한 경험", instead: "무슨 경험인지 구체적으로" },
  { phrase: "다양한 활동", instead: "무슨 활동인지 구체적으로" },
];

/** 자소서에서 흔한 상투어 (기업 칭찬·빈 다짐) */
export const CLICHE_PHRASES = [
  "귀사에 기여",
  "귀사의 비전",
  "감명받아",
  "매력을 느껴",
  "업계 1위",
  "선도하는 기업",
  "역량을 함양",
  "최선을 다하겠",
  "열심히 하겠",
  "이바지하겠",
  "기여하는 인재",
  "성실하고 책임감",
  "적성에 맞아",
  "어릴 때부터",
  "어린 시절부터",
  "시너지",
  "패러다임",
  "귀중한 경험",
  "값진 경험",
];

/** 접속사 — 하나씩은 괜찮지만 반복되면 티가 난다 */
const CONNECTIVES = ["또한", "게다가", "결과적으로", "따라서", "그러므로", "이를 통해", "뿐만 아니라"];

/** 번역투 */
const TRANSLATIONESE = ["에 다름 아니", "를 가집니다", "을 가집니다", "되어집니다", "지어졌습니다", "에 의해"];

export type TellKind =
  | "comma"
  | "phrase"
  | "cliche"
  | "connective"
  | "rhythm"
  | "long"
  | "translationese";

export interface AiTell {
  kind: TellKind;
  severity: "high" | "medium";
  title: string;
  detail: string;
  /** 걸린 문장 (있으면 화면에 그대로 보여준다) */
  sample?: string;
}

/** 문장 단위로 자른다. 한국어 자소서는 '습니다.'로 끝나는 게 대부분이다 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const chars = (s: string) => Array.from(s).length;

export function inspectAiTells(text: string): AiTell[] {
  const tells: AiTell[] = [];
  if (!text.trim()) return tells;

  const sentences = splitSentences(text);

  // ① 한 문장에 쉼표 3개 이상 — 만연체의 신호
  const commaHeavy = sentences.filter((s) => (s.match(/,/g) || []).length >= 3);
  if (commaHeavy.length > 0) {
    tells.push({
      kind: "comma",
      severity: "high",
      title: `쉼표가 몰린 문장 ${commaHeavy.length}개`,
      detail: "한 문장에 쉼표가 3개 이상이면 AI 문장으로 보기 쉽습니다. 쉼표 자리에서 문장을 끊어보세요.",
      sample: commaHeavy[0],
    });
  }

  // ② 지나치게 긴 문장
  const tooLong = sentences.filter((s) => chars(s) >= 90);
  if (tooLong.length > 0) {
    tells.push({
      kind: "long",
      severity: "medium",
      title: `90자를 넘는 문장 ${tooLong.length}개`,
      detail: "길게 늘이면 의도가 흐려집니다. 두 문장으로 나눠보세요.",
      sample: tooLong[0],
    });
  }

  // ③ 문장 길이가 다 비슷함 — 리듬이 없다
  if (sentences.length >= 4) {
    const lens = sentences.map(chars);
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
    const shortOnes = lens.filter((l) => l <= 25).length;

    if (mean > 0 && sd / mean < 0.35 && shortOnes === 0) {
      tells.push({
        kind: "rhythm",
        severity: "medium",
        title: "문장 길이가 고릅니다",
        detail:
          `평균 ${Math.round(mean)}자에 짧은 문장이 하나도 없습니다. ` +
          "긴 문장 뒤에 짧고 강한 한 문장을 섞으면 사람 글처럼 읽힙니다.",
      });
    }
  }

  // ④ AI가 즐겨 쓰는 표현
  for (const { phrase, instead } of AI_PHRASES) {
    if (text.includes(phrase)) {
      tells.push({
        kind: "phrase",
        severity: "high",
        title: `“${phrase}”`,
        detail: `AI가 특히 자주 쓰는 말입니다. → ${instead}`,
        sample: sentences.find((s) => s.includes(phrase)),
      });
    }
  }

  // ⑤ 상투어
  const clicheHits = CLICHE_PHRASES.filter((p) => text.includes(p));
  if (clicheHits.length > 0) {
    tells.push({
      kind: "cliche",
      severity: "high",
      title: `상투적인 표현 ${clicheHits.length}개`,
      detail: `${clicheHits.join(" · ")} — 누구나 쓰는 말이라 눈에 남지 않습니다.`,
    });
  }

  // ⑥ 접속사 반복
  const connCount = CONNECTIVES.reduce(
    (sum, c) => sum + (text.match(new RegExp(c, "g")) || []).length,
    0
  );
  if (connCount >= 3) {
    tells.push({
      kind: "connective",
      severity: "medium",
      title: `접속사 ${connCount}번`,
      detail:
        "‘또한·게다가·결과적으로’가 반복되면 기계가 이어붙인 느낌이 납니다. " +
        "문맥으로 통하면 지우는 쪽이 세련됩니다.",
    });
  }

  // ⑦ 번역투
  const transHits = TRANSLATIONESE.filter((p) => text.includes(p));
  if (transHits.length > 0) {
    tells.push({
      kind: "translationese",
      severity: "medium",
      title: "번역투",
      detail: `${transHits.join(" · ")} — 수동태와 번역투는 자연스러운 우리말로 바꾸세요.`,
    });
  }

  // 심각한 것부터
  return tells.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
}
