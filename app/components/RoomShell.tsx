"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import ThemeCustomizer from "./ThemeCustomizer";
import { applyTheme, loadTheme, saveTheme } from "@/lib/theme";

export interface RoomUser {
  id: string;
  email: string;
  name: string | null;
  theme?: string | null; // DB에 저장된 StoredTheme JSON 문자열
}

const NAV = [
  { href: "/bookshelf", icon: "📚", label: "책장" },
  { href: "/create", icon: "✍️", label: "새로 만들기" },
  { href: "/evaluate", icon: "🧑‍⚖️", label: "평가단" },
];

export default function RoomShell({
  user,
  title,
  actions,
  flush = false,
  children,
}: {
  user: RoomUser;
  /** 상단바에 걸리는 페이지 제목. 없으면 메뉴에서 현재 위치로 채운다 */
  title?: string;
  /** 상단바 우측에 놓을 페이지별 버튼 */
  actions?: React.ReactNode;
  /** 본문이 남는 영역을 가장자리만 남기고 꽉 채우게 한다 (예: 펼친 책) */
  flush?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // 테마 적용: DB(user.theme)를 진실원본으로, localStorage에 미러(무깜빡임용).
  // FOUC는 layout의 인라인 스크립트(localStorage)가 막고, 여기서 DB값으로 동기화한다.
  useEffect(() => {
    if (user.theme) {
      try {
        const stored = JSON.parse(user.theme);
        applyTheme(stored);
        saveTheme(stored); // localStorage 미러 갱신
        return;
      } catch {
        /* 형식 깨졌으면 localStorage로 폴백 */
      }
    }
    applyTheme(loadTheme());
  }, [user.theme]);

  const current = NAV.find((item) => item.href === pathname);
  const heading = title ?? (current ? `${current.icon} ${current.label}` : "");

  // 드롭다운 바깥을 클릭하거나 ESC를 누르면 닫기
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="tp-room">
      {/* 좌측 메뉴바 */}
      <aside className="tp-sidebar">
        <Link href="/bookshelf" className="tp-logo">
          🏠 <span>방구석 팀플</span>
        </Link>

        <nav className="tp-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="tp-nav-item"
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span className="tp-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* 메뉴바 하단: 유저 + 설정 */}
        <div className="tp-sidebar-foot" ref={settingsRef}>
          <span className="tp-user">{user.name || user.email}님의 방 안</span>

          <button
            type="button"
            className="tp-gear"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="설정"
          >
            ⚙️
          </button>

          {/* 메뉴바 맨 아래라 아래로 펼치면 잘려서, 위로 펼친다 */}
          {menuOpen && (
            <div className="tp-menu tp-menu-up" role="menu">
              <button
                type="button"
                className="tp-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setThemeOpen(true);
                }}
              >
                🎨 책장 커스텀하기
              </button>
              <button
                type="button"
                className="tp-menu-item"
                role="menuitem"
                onClick={handleLogout}
              >
                🚪 로그아웃
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="tp-main">
        {/* 상단바: 페이지 제목 */}
        <header className="tp-topbar">
          <h1 className="tp-page-heading">{heading}</h1>
          {actions && <div className="tp-topbar-actions">{actions}</div>}
        </header>

        <main className={flush ? "tp-content tp-content-flush" : "tp-content"}>
          {children}
        </main>
      </div>

      {themeOpen && <ThemeCustomizer onClose={() => setThemeOpen(false)} />}
    </div>
  );
}
