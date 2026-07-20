"use client";

import { useState } from "react";
import {
  THEME_PRESETS,
  CUSTOM_GROUPS,
  StoredTheme,
  ThemePalette,
  applyTheme,
  loadTheme,
  saveTheme,
  resolvePalette,
  darken,
} from "@/lib/theme";

export default function ThemeCustomizer({ onClose }: { onClose: () => void }) {
  // 저장된 테마로 시작 (모달은 클릭 시에만 열리므로 SSR 걱정 없음)
  const [stored, setStored] = useState<StoredTheme>(() => loadTheme());
  const palette = resolvePalette(stored);

  const commit = (next: StoredTheme) => {
    setStored(next);
    applyTheme(next); // 바로 화면에 반영
    saveTheme(next); // localStorage 미러 (무깜빡임)
    // DB에도 저장 (다른 기기에서도 유지). 실패해도 화면/로컬은 유지되므로 조용히 처리.
    fetch("/api/user/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  };

  const choosePreset = (id: string) => commit({ mode: "preset", id });

  const changeColor = (key: keyof ThemePalette, value: string) => {
    const next: ThemePalette = { ...palette, [key]: value };
    // 버튼색을 바꾸면 hover색은 자동으로 살짝 어둡게 맞춘다
    if (key === "sage") next.sageDark = darken(value);
    commit({ mode: "custom", palette: next });
  };

  const changeBook = (index: number, value: string) => {
    const books = palette.books.slice();
    books[index] = value;
    commit({ mode: "custom", palette: { ...palette, books } });
  };

  return (
    <div className="tp-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tp-modal-head">
          <span className="tp-modal-title">🎨 책장 커스텀하기</span>
          <button type="button" className="tp-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="tp-modal-body tp-theme-body">
          {/* 1) 추천 테마 세트 */}
          <p className="tp-theme-hint">추천 테마</p>
          <div className="tp-theme-grid">
            {THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tp-theme-card"
                aria-pressed={stored.mode === "preset" && stored.id === t.id}
                onClick={() => choosePreset(t.id)}
              >
                <span className="tp-theme-swatch" style={{ background: t.palette.wall }}>
                  <span style={{ background: t.palette.wood }} />
                  <span style={{ background: t.palette.shelf }} />
                  <span style={{ background: t.palette.sage }} />
                  <span style={{ background: t.palette.cream }} />
                </span>
                <span className="tp-theme-name">
                  {t.emoji} {t.name}
                </span>
                {stored.mode === "preset" && stored.id === t.id && (
                  <span className="tp-theme-check">✓</span>
                )}
              </button>
            ))}
          </div>

          {/* 2) 완전 커스텀 (섹션별로 구분) */}
          <p className="tp-theme-hint tp-theme-hint-custom">
            직접 만들기 {stored.mode === "custom" && <span className="tp-theme-badge">커스텀 적용 중</span>}
          </p>

          {CUSTOM_GROUPS.map((group) => (
            <div className="tp-custom-section" key={group.title}>
              <p className="tp-custom-subtitle">{group.title}</p>
              <div className="tp-custom-grid">
                {group.fields.map((f) => (
                  <label className="tp-custom-row" key={f.key}>
                    <input
                      type="color"
                      className="tp-theme-color"
                      value={palette[f.key]}
                      onChange={(e) => changeColor(f.key, e.target.value)}
                      aria-label={`${f.label} 색`}
                    />
                    <span className="tp-custom-label">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* 책 표지 6색 */}
          <div className="tp-custom-section">
            <p className="tp-custom-subtitle">📚 책 표지</p>
            <div className="tp-book-row">
              {palette.books.map((c, i) => (
                <label className="tp-book-pick" key={i} title={`책 색 ${i + 1}`}>
                  <input
                    type="color"
                    className="tp-theme-color"
                    value={c}
                    onChange={(e) => changeBook(i, e.target.value)}
                    aria-label={`책 색 ${i + 1}`}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="tp-modal-foot">
          <button type="button" className="tp-btn" onClick={onClose}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
