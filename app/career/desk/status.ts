// 지원 건의 진행 상태. 책상 카드와 상세가 같은 정의를 본다.

export const STATUSES = [
  { id: "preparing", label: "준비 중" },
  { id: "submitted", label: "제출함" },
  { id: "doc_pass", label: "서류 합격" },
  { id: "interview", label: "면접" },
  { id: "closed", label: "종료" },
] as const;

export function statusLabel(id: string): string {
  return STATUSES.find((s) => s.id === id)?.label ?? id;
}

/** 마감까지 며칠 남았는지. 지났으면 음수, 마감이 없으면 null */
export function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  const a = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86400000);
}

/** D-7, D-day, D+3 형태로 */
export function ddayLabel(deadline: string | null): string | null {
  const d = daysLeft(deadline);
  if (d === null) return null;
  if (d === 0) return "D-day";
  return d > 0 ? `D-${d}` : `D+${-d}`;
}

/** 마감이 임박했나 (카드 강조용) */
export function isUrgent(deadline: string | null, status: string): boolean {
  if (status !== "preparing") return false;
  const d = daysLeft(deadline);
  return d !== null && d >= 0 && d <= 7;
}
