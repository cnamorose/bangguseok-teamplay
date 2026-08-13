// 경험의 칸 정의. 목록·편집·완성도 계산이 모두 이 배열을 본다.

export interface ExpFields {
  title: string;
  period: string | null;
  role: string | null;
  situation: string | null;
  action: string | null;
  impact: string | null;
  learning: string | null;
  message: string | null;
  tags: string[];
}

export interface Gap {
  field: string;
  issue: string;
  question: string;
  /** 정리 단계에선 대개 비어 있고(=부족함), 점검 단계에서 종류가 붙는다 */
  kind?: "missing" | "misplaced" | "vague" | "subject";
}

export interface Experience extends ExpFields {
  id: string;
  gaps: Gap[] | null;
  starred: boolean;
  organizedAt: string | null;
  updatedAt: string;
}

export type FieldKey = "period" | "role" | "situation" | "action" | "impact" | "learning" | "message";

// STAR 순서로 놓았다. 라벨 옆의 S·T·A·R이 어느 칸인지 알려준다.
export const FIELDS: {
  key: FieldKey;
  label: string;
  placeholder: string;
  long?: boolean;
}[] = [
  { key: "period", label: "기간", placeholder: "2025년 2학기 · 2025.03~08" },
  {
    key: "role",
    label: "맡은 것 (T)",
    placeholder: "4인 팀에서 백엔드 담당 — '참여'가 아니라 무엇을 책임졌는지",
  },
  {
    key: "situation",
    label: "상황 · 문제 (S)",
    placeholder: "어디서 어떤 문제였나요? 예) 4인 팀 프로젝트, 로딩이 3초를 넘어 이탈이 잦았음",
    long: true,
  },
  {
    key: "action",
    label: "내가 한 일 (A)",
    placeholder: "쓴 도구·방법 이름까지. 왜 그렇게 했는지와 해보다 안 됐던 시도도 적으면 좋아요",
    long: true,
  },
  {
    key: "impact",
    label: "결과 (R)",
    placeholder: "무엇이 달라졌나요? 숫자가 있으면 그대로 (3초→0.8초). 없으면 '전에는 ~였는데'",
    long: true,
  },
  { key: "learning", label: "배운 점", placeholder: "이 경험에서 남은 것" },
  { key: "message", label: "한 줄 메시지", placeholder: "이 경험이 말하는 나 — 예: 데이터로 원인을 찾는 사람" },
];

/** 채워진 칸 수 / 전체 (태그 포함 8칸) */
export function completeness(e: ExpFields) {
  const filled =
    FIELDS.filter((f) => (e[f.key] ?? "").toString().trim().length > 0).length +
    (e.tags.length > 0 ? 1 : 0);
  return { filled, total: FIELDS.length + 1 };
}

/** 화면에서 바로 계산하는 경고 — LLM을 다시 부르지 않는다 */
export function quickWarnings(e: ExpFields): string[] {
  const out: string[] = [];
  if (!e.impact?.trim()) out.push("결과가 비어 있어요");
  if (!e.message?.trim()) out.push("한 줄 메시지가 없어요");
  if (e.tags.length === 0) out.push("키워드가 없어요");
  return out;
}
