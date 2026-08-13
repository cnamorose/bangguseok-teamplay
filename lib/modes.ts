// 방(모드) 정의.
// 메뉴와 홈 경로를 여기 한 곳에서만 관리한다. 방을 늘리려면 이 파일만 고치면 된다.
//
// 현재 있는 방이 어디인지는 'URL'이 진실원본이다. (새로고침·뒤로가기·공유가 다 살아난다)
// DB의 User.mode는 "/" 로 들어오거나 로그인했을 때 어느 방으로 보낼지 기억하는 용도.

export type ModeId = "study" | "career";

export interface NavItem {
  href: string;
  icon: string;
  label: string;
}

export interface Mode {
  id: ModeId;
  label: string;
  emoji: string;
  home: string; // 이 방에 들어왔을 때 첫 화면
  nav: NavItem[];
}

export const MODES: Record<ModeId, Mode> = {
  study: {
    id: "study",
    label: "공부방",
    emoji: "📚",
    home: "/study/bookshelf",
    nav: [
      { href: "/study/bookshelf", icon: "📚", label: "책장" },
      { href: "/study/create", icon: "✍️", label: "새로 만들기" },
      { href: "/study/evaluate", icon: "🧑‍⚖️", label: "평가단" },
    ],
  },
  career: {
    id: "career",
    label: "취업방",
    emoji: "💼",
    home: "/career/desk",
    nav: [
      { href: "/career/desk", icon: "🗂️", label: "책상" },
      { href: "/career/experience", icon: "🧰", label: "내 경험" },
      { href: "/career/companies", icon: "🏢", label: "기업 분석" },
      { href: "/career/resume", icon: "📝", label: "자소서 작성" },
      { href: "/career/consult", icon: "🔍", label: "자소서 첨삭" },
      { href: "/career/interview", icon: "🎤", label: "면접 준비" },
    ],
  },
};

export const DEFAULT_MODE: ModeId = "study";

export const MODE_LIST: Mode[] = [MODES.study, MODES.career];

/** 알 수 없는 값(옛 데이터·손댄 요청)이 들어와도 안전하게 방 id로 만든다 */
export function toModeId(value: unknown): ModeId {
  return value === "career" || value === "study" ? value : DEFAULT_MODE;
}

/**
 * 지금 URL이 어느 방인지.
 * /result, /clipboard처럼 두 방이 같이 쓰는 화면은 공부방으로 친다.
 * (지금은 공부방 결과물에서만 열리므로. 취업방에서도 열게 되면 그때 판별 기준을 넓힌다)
 */
export function modeFromPath(pathname: string): ModeId {
  return pathname.startsWith("/career") ? "career" : "study";
}

/** 그 방의 첫 화면 경로 */
export function homeOf(value: unknown): string {
  return MODES[toModeId(value)].home;
}
