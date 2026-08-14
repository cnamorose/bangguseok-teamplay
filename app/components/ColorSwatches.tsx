"use client";

import { SHELF_COLORS } from "@/lib/shelf-color";

// 인덱스 탭 색 고르는 줄. 만들 때(새로 만들기)와 고칠 때(책장·책상)가 같은 걸 쓴다.
// 마지막 ↺는 "자동" — 안 고른 상태로 되돌리면 id에서 색을 뽑는다.

export default function ColorSwatches({
  value,
  onPick,
  className = "ui-swatchrow",
}: {
  value: string | null;
  onPick: (color: string | null) => void;
  className?: string;
}) {
  return (
    <div className={className} role="radiogroup" aria-label="색 고르기">
      {SHELF_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          className="ui-swatch"
          style={{ background: `var(--${c})` }}
          onClick={() => onPick(c)}
          aria-label={c}
        />
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        className="ui-swatch is-auto"
        onClick={() => onPick(null)}
        title="자동으로 고르기"
        aria-label="자동으로 고르기"
      >
        ↺
      </button>
    </div>
  );
}
