"use client";

// 세그먼트 토글 (책장 탭과 같은 모양).
//
// 예전엔 활성 버튼의 위치를 재서 thumb를 슬라이드시켰는데, 새 디자인에서는
// 고른 버튼 자체가 밝은 면이 되므로 그 계산이 필요 없어졌다. 그래서 다 걷어냈다.

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
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
