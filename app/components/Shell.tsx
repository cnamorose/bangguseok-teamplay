"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LIVING, MODES, MODE_LIST, ModeId, modeFromPath, toModeId } from "@/lib/modes";

// 앱 껍데기.
//
// 상단바를 없앴다 — 제목은 각 화면의 머리말이 하고 있어서 같은 걸 두 번 보여주던 셈이다.
// 사이드바는 접을 수 있고(232px ↔ 62px), 밝기와 함께 브라우저에 기억된다.
//
// 밝기 전환은 계정 메뉴 안에 둔다 — 하루에 한 번 누를까 말까 한 것이라
// 사이드바 바닥에 상시로 자리를 차지할 이유가 없다.

export interface ShellUser {
  id: string;
  email: string;
  name: string | null;
  mode?: string | null;
}

const MODE_KEY = "tp-mode";
const COLLAPSE_KEY = "tp-side-collapsed";

export default function Shell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const footRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(localStorage.getItem(MODE_KEY) === "dark");
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const flipDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(MODE_KEY, next ? "dark" : "light");
  };

  const flipSide = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!footRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // 거실처럼 방 밖인 화면에선 마지막에 있던 방의 메뉴를 유지한다
  const mode = modeFromPath(pathname) ?? toModeId(user.mode);
  const nav = MODES[mode].nav;
  const inLiving = pathname.startsWith(LIVING.href);

  const switchMode = (next: ModeId) => {
    if (next === mode) return;
    router.push(MODES[next].home);
    fetch("/api/user/mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    }).catch(() => {});
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="ui" data-mode={dark ? "dark" : "light"} data-collapsed={collapsed}>
      {/* 사이드바 밖에 둔다 — 안에 두면 사이드바의 스크롤이 이 버튼을 잘라낸다 */}
      <button
        className="ui-collapse"
        onClick={flipSide}
        aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
        title={collapsed ? "펼치기" : "접기"}
      >
        {collapsed ? "›" : "‹"}
      </button>

      <aside className="ui-side">
        <Link href={MODES[mode].home} className="ui-logo" title="방구석 스터디">
          <span className="ui-logo-mark">🏠</span>
          {!collapsed && <span>방구석 스터디</span>}
        </Link>

        <div className="ui-rooms" role="tablist" aria-label="방 이동">
          {MODE_LIST.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className="ui-room"
              onClick={() => switchMode(m.id)}
              title={m.label}
            >
              {collapsed ? m.emoji : `${m.emoji} ${m.label}`}
            </button>
          ))}
        </div>

        <nav className="ui-nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="ui-navitem"
              title={item.label}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span className="ui-navicon">{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          ))}

          <span className="ui-navsep" />

          {/* 거실은 방이 아니라 방 밖이다 */}
          <Link
            href={LIVING.href}
            className="ui-navitem"
            title={LIVING.label}
            aria-current={inLiving ? "page" : undefined}
          >
            <span className="ui-navicon">{LIVING.icon}</span>
            {!collapsed && LIVING.label}
          </Link>
        </nav>

        <div className="ui-foot" ref={footRef}>
          {collapsed ? (
            <button
              className="ui-iconbtn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={user.name || user.email}
            >
              <span className="ui-avatar">{(user.name || user.email)[0].toUpperCase()}</span>
            </button>
          ) : (
            <button
              className="ui-user"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="ui-avatar">{(user.name || user.email)[0].toUpperCase()}</span>
              <span className="ui-username">{user.name || user.email.split("@")[0]}</span>
            </button>
          )}

          {menuOpen && (
            <div className="ui-menu" role="menu">
              {/* 눌러도 메뉴를 닫지 않는다 — 바뀐 화면을 보고 되돌리는 게 흔하다 */}
              <button role="menuitem" onClick={flipDark}>
                {dark ? "☀️ 밝은 화면" : "🌙 어두운 화면"}
              </button>
              <span className="ui-menusep" />
              <button role="menuitem" onClick={logout}>
                🚪 로그아웃
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="ui-main">{children}</main>
    </div>
  );
}
