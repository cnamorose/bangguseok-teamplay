// 책장·책상 카드의 인덱스 탭 색.
//
// DB에는 색값(#c67a52)이 아니라 자리 이름("book-3")을 담는다.
// 테마가 --book-1~6을 덮어쓰면 사용자가 고른 색도 같이 따라가야 하기 때문이다.

/** globals.css의 --book-1 ~ --book-6 */
export const SHELF_COLORS = [
  "book-1",
  "book-2",
  "book-3",
  "book-4",
  "book-5",
  "book-6",
] as const;

export type ShelfColor = (typeof SHELF_COLORS)[number];

/** 서버가 받은 값이 쓸 수 있는 색인지 (아무 문자열이나 저장되지 않게) */
export function isShelfColor(v: unknown): v is ShelfColor {
  return typeof v === "string" && (SHELF_COLORS as readonly string[]).includes(v);
}

/**
 * 화면에 칠할 CSS 값.
 * 고른 색이 있으면 그걸, 없으면 id에서 뽑아 쓴다 —
 * 지정하지 않아도 카드마다 다른 색이 나오되 새로고침해도 안 바뀌게.
 */
export function shelfColor(id: string, picked?: string | null): string {
  if (isShelfColor(picked)) return `var(--${picked})`;

  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return `var(--${SHELF_COLORS[Math.abs(hash) % SHELF_COLORS.length]})`;
}
