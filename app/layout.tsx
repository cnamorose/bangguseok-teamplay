import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { THEME_PRESETS, THEME_VAR_MAP, THEME_KEY, DEFAULT_THEME_ID } from "@/lib/theme";

// 본문·제목 공통: Noto Sans KR (제목은 CSS에서 굵게)
const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "방구석 스터디",
  description: "내 방 책장에서 시작하는 공부와 취업 준비",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 인라인 스크립트용 데이터 (빌드 시점에 직렬화): 프리셋 팔레트 맵 + 필드→변수 맵
  const presetMap = Object.fromEntries(THEME_PRESETS.map((p) => [p.id, p.palette]));
  const themeScript = `(function(){try{var PM=${JSON.stringify(
    presetMap
  )},FV=${JSON.stringify(THEME_VAR_MAP)},K=${JSON.stringify(THEME_KEY)},D=${JSON.stringify(
    DEFAULT_THEME_ID
  )};var raw=localStorage.getItem(K)||"";var s=null;try{s=JSON.parse(raw)}catch(e){}var pal;if(s&&s.mode==="custom"&&s.palette){pal=s.palette}else{var id=(s&&s.mode==="preset"&&s.id)?s.id:(PM[raw]?raw:D);pal=PM[id]||PM[D]}var r=document.documentElement;Object.keys(FV).forEach(function(f){if(pal[f])r.style.setProperty(FV[f],pal[f])});if(pal.books){pal.books.forEach(function(c,i){r.style.setProperty("--book-"+(i+1),c)})}}catch(e){}})();`;

  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* 저장된 테마를 그리기 전에 적용해 새로고침 시 색 깜빡임 방지 */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
