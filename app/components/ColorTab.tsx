"use client";

import { useEffect, useRef, useState } from "react";
import ColorSwatches from "./ColorSwatches";
import { shelfColor } from "@/lib/shelf-color";

// 카드 위쪽에 꽂힌 인덱스 탭. 누르면 색을 고를 수 있다.
//
// 카드 자체가 눌러서 들어가는 버튼이라, 여기서 일어난 클릭은 위로 안 올려보낸다.
// 안 그러면 색을 고르려다 상세 화면으로 넘어간다.

export default function ColorTab({
  id,
  color,
  onPick,
}: {
  id: string;
  /** 사용자가 고른 색 ("book-3") · 없으면 id에서 뽑는다 */
  color: string | null;
  onPick: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const close = (value: string | null) => {
    setOpen(false);
    onPick(value);
  };

  return (
    <div className="ui-tabpick" ref={boxRef} onKeyDown={stop}>
      <button
        type="button"
        className="ui-tab"
        style={{ background: shelfColor(id, color) }}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="색 바꾸기"
        title="색 바꾸기"
      />

      {open && (
        <div onClick={stop} onMouseDown={stop}>
          <ColorSwatches className="ui-swatches" value={color} onPick={close} />
        </div>
      )}
    </div>
  );
}
