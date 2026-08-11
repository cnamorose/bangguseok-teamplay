"use client";

import { useEffect, useRef, useState } from "react";

// 슬라이딩 인디케이터가 붙은 세그먼트 토글.
// 활성 버튼의 실제 위치·너비를 재서 thumb를 옮기므로 라벨 길이가 달라도 정확히 맞는다.
// (책장 탭과 방 전환이 같은 컴포넌트를 쓴다)

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const btnRefs = useRef(new Map<T, HTMLButtonElement>());
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = btnRefs.current.get(value);
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, options]);

  return (
    <div className={`tp-view-toggle ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {thumb && (
        <span
          className="tp-view-toggle-thumb"
          style={{ left: thumb.left, width: thumb.width }}
          aria-hidden="true"
        />
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          ref={(el) => {
            if (el) btnRefs.current.set(opt.value, el);
            else btnRefs.current.delete(opt.value);
          }}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`tp-view-toggle-btn${value === opt.value ? " is-active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
