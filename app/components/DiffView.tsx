"use client";

import { useMemo } from "react";
import { diffWords } from "diff";

// 원본 ↔ 수정본을 나란히 놓고 바뀐 곳을 표시한다.
// 공부방 평가단(회의 → 수정본)과 취업방 첨삭단이 같이 쓴다.
//
// 한쪽에 몰아 보여주지 않고 두 면으로 나눈 이유는, 무엇이 빠졌고 무엇이 들어왔는지를
// 각각 온전한 글로 읽을 수 있어야 판단이 되기 때문이다.

export default function DiffView({
  original,
  revised,
  leftLabel = "📝 내 글",
  rightLabel = "✨ 수정본",
}: {
  original: string;
  revised: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const parts = useMemo(
    () => (original && revised ? diffWords(original, revised) : []),
    [original, revised]
  );

  if (parts.length === 0) return null;

  return (
    <div className="tp-diff">
      <div className="tp-diff-pane">
        <div className="tp-diff-head tp-diff-head-del">
          {leftLabel} <span>지워진 부분</span>
        </div>
        <div className="tp-diff-body">
          {parts
            .filter((p) => !p.added)
            .map((p, i) =>
              p.removed ? (
                <del key={i} className="tp-diff-del">{p.value}</del>
              ) : (
                <span key={i}>{p.value}</span>
              )
            )}
        </div>
      </div>

      <div className="tp-diff-pane">
        <div className="tp-diff-head tp-diff-head-add">
          {rightLabel} <span>더해진 부분</span>
        </div>
        <div className="tp-diff-body">
          {parts
            .filter((p) => !p.removed)
            .map((p, i) =>
              p.added ? (
                <ins key={i} className="tp-diff-add">{p.value}</ins>
              ) : (
                <span key={i}>{p.value}</span>
              )
            )}
        </div>
      </div>
    </div>
  );
}
