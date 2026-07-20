// 책장(테마): 미리 맞춘 프리셋 중 하나를 고르거나, 모든 색을 직접 커스텀한다.
// 선택한 팔레트를 :root CSS 변수로 덮어써서 전역 적용. 저장은 localStorage.

export interface ThemePalette {
  wall: string;        // 배경(방 벽)
  shelf: string;       // 좌측 메뉴바(책장)
  shelfBorder: string; // 책장 선반선
  wood: string;        // 상단 바(헤더)
  sage: string;        // 버튼/강조
  sageDark: string;    // 버튼 hover/링크 (버튼색에서 자동 계산)
  paper: string;       // 카드(종이) 밝은 면
  cream: string;       // 칩·점수판·모달 등 크림 면
  ivory: string;       // 펼친 책 내지 등 가장 밝은 면
  ink: string;         // 테두리 선(도트)
  text: string;        // 본문 글자
  textMuted: string;   // 보조 글자
  books: string[];     // 책 표지 색 (BOOK_COUNT개)
}

// 책 표지 색 개수 (--book-1 ~ --book-N)
export const BOOK_COUNT = 6;

export interface ThemePreset {
  id: string;
  name: string;
  emoji: string;
  palette: ThemePalette;
}

// 저장 형태: 프리셋 선택 또는 완전 커스텀
export type StoredTheme =
  | { mode: "preset"; id: string }
  | { mode: "custom"; palette: ThemePalette };

export const THEME_KEY = "tp-theme";
export const DEFAULT_THEME_ID = "oak";

// 팔레트 단일색 필드 ↔ CSS 변수명 (books는 배열이라 별도 처리)
export const THEME_VAR_MAP: Record<Exclude<keyof ThemePalette, "books">, string> = {
  wall: "--wall",
  shelf: "--shelf",
  shelfBorder: "--shelf-border",
  wood: "--wood",
  sage: "--sage",
  sageDark: "--sage-dark",
  paper: "--paper",
  cream: "--cream",
  ivory: "--ivory",
  ink: "--ink",
  text: "--text",
  textMuted: "--text-muted",
};

// 커스텀 화면을 섹션으로 묶어 노출. sageDark는 버튼색에서 자동 계산해 숨김.
// books(책 표지)는 배열이라 별도 섹션으로 다룬다.
type ColorKey = Exclude<keyof ThemePalette, "books">;

export const CUSTOM_GROUPS: { title: string; fields: { key: ColorKey; label: string }[] }[] = [
  {
    title: "🏠 방 · 가구",
    fields: [
      { key: "wall", label: "배경" },
      { key: "wood", label: "상단 바" },
      { key: "shelf", label: "좌측 메뉴바" },
      { key: "shelfBorder", label: "선반 선" },
    ],
  },
  {
    title: "📄 종이 · 면",
    fields: [
      { key: "paper", label: "카드" },
      { key: "cream", label: "크림 면" },
      { key: "ivory", label: "내지" },
    ],
  },
  {
    title: "🔘 버튼 · 글자 · 선",
    fields: [
      { key: "sage", label: "버튼" },
      { key: "ink", label: "테두리 선" },
      { key: "text", label: "글자" },
      { key: "textMuted", label: "보조 글자" },
    ],
  },
];

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "oak", name: "원목", emoji: "🪵",
    palette: {
      wall: "#4a3728", shelf: "#5c4433", shelfBorder: "#6b4f3a",
      wood: "#7a5a3a", sage: "#7fa06a", sageDark: "#6b8a58",
      paper: "#fdf6ec", cream: "#f6eeda", ivory: "#fffdf5",
      ink: "#2a1f17", text: "#3f2e20", textMuted: "#8a7a6a",
      books: ["#c67a52", "#d3a85e", "#8faf74", "#6d94b0", "#9a7bb5", "#b05f5f"],
    },
  },
  {
    id: "forest", name: "숲", emoji: "🌿",
    palette: {
      wall: "#2c3a2a", shelf: "#3a4d36", shelfBorder: "#486045",
      wood: "#3f5a3a", sage: "#8faf74", sageDark: "#799a60",
      paper: "#f1f6ec", cream: "#e6efdb", ivory: "#fafdf5",
      ink: "#1e2a17", text: "#2f3a28", textMuted: "#74806a",
      books: ["#6f9a52", "#4f8a4e", "#a8b25e", "#c08a4a", "#5f8a7a", "#a85f4a"],
    },
  },
  {
    id: "ocean", name: "바다", emoji: "🌊",
    palette: {
      wall: "#26363f", shelf: "#334b57", shelfBorder: "#3f5e6d",
      wood: "#3b5f6c", sage: "#5fa2a2", sageDark: "#4f8a8a",
      paper: "#ecf3f6", cream: "#dbe9ef", ivory: "#f5fbfd",
      ink: "#172a2f", text: "#26363b", textMuted: "#6a7c82",
      books: ["#4f93a0", "#5f7db0", "#7aa8a8", "#d0a45f", "#6d84b0", "#b06a6a"],
    },
  },
  {
    id: "amethyst", name: "자수정", emoji: "🔮",
    palette: {
      wall: "#332840", shelf: "#453553", shelfBorder: "#564067",
      wood: "#4c3c5d", sage: "#9a7bb5", sageDark: "#84679f",
      paper: "#f2eef7", cream: "#e7dcef", ivory: "#faf6fd",
      ink: "#201727", text: "#33283b", textMuted: "#7a6f82",
      books: ["#9a7bb5", "#7d6aa8", "#b58fbf", "#8a6d94", "#b06a8a", "#6d7bb0"],
    },
  },
  {
    id: "dusk", name: "노을", emoji: "🌆",
    palette: {
      wall: "#4a2e28", shelf: "#5e3d33", shelfBorder: "#724c40",
      wood: "#6d4a3a", sage: "#c67a52", sageDark: "#ac6644",
      paper: "#f9efe8", cream: "#f1e0d3", ivory: "#fdf6f1",
      ink: "#2a1712", text: "#40291f", textMuted: "#8a7266",
      books: ["#c67a52", "#cf8f5f", "#d3a85e", "#a85f4a", "#97854a", "#9a665f"],
    },
  },
  {
    id: "ink", name: "먹", emoji: "🌑",
    palette: {
      wall: "#2a2a30", shelf: "#393940", shelfBorder: "#4a4a53",
      wood: "#44444e", sage: "#8a93a5", sageDark: "#767f90",
      paper: "#eff0f3", cream: "#e1e2e7", ivory: "#f9fafb",
      ink: "#1a1a1f", text: "#2f2f34", textMuted: "#74767f",
      books: ["#7f8a9a", "#6d7580", "#92868f", "#8a9a8f", "#9a8f86", "#75808f"],
    },
  },
];

export function getPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((t) => t.id === id);
}

// hex 색을 약간 어둡게 (버튼 hover/링크 --sage-dark 자동 생성)
export function darken(hex: string, factor = 0.85): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function resolvePalette(stored: StoredTheme): ThemePalette {
  if (stored.mode === "custom") return stored.palette;
  return (getPreset(stored.id) ?? getPreset(DEFAULT_THEME_ID)!).palette;
}

export function applyPalette(p: ThemePalette) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of Object.keys(THEME_VAR_MAP) as (keyof typeof THEME_VAR_MAP)[]) {
    root.style.setProperty(THEME_VAR_MAP[key], p[key]);
  }
  p.books?.forEach((c, i) => root.style.setProperty(`--book-${i + 1}`, c));
}

export function applyTheme(stored: StoredTheme) {
  applyPalette(resolvePalette(stored));
}

export function loadTheme(): StoredTheme {
  const fallback: StoredTheme = { mode: "preset", id: DEFAULT_THEME_ID };
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(THEME_KEY);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    if (v?.mode === "custom" && v.palette) return { mode: "custom", palette: v.palette };
    if (v?.mode === "preset" && v.id) {
      return { mode: "preset", id: getPreset(v.id) ? v.id : DEFAULT_THEME_ID };
    }
  } catch {
    // 옛 형식(문자열 id) 호환
    if (getPreset(raw)) return { mode: "preset", id: raw };
  }
  return fallback;
}

export function saveTheme(stored: StoredTheme) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(THEME_KEY, JSON.stringify(stored));
}
