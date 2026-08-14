"use client";

import { useState } from "react";

// 결과물 화면에 붙는 공유 버튼.
// 자소서는 개인 경험과 지원 사실이 묻어 있으므로 한 번 확인을 받는다.

export default function ShareButton({
  kind,
  targetId,
  label = "🔗 공유",
}: {
  kind: "result" | "essay";
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"link" | "login">(kind === "essay" ? "login" : "link");
  // 거실 노출은 링크를 만드는 것과 별개의 결정이라 따로 묻는다. 기본은 끔
  const [listed, setListed] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, targetId, scope, listed }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "공유하지 못했습니다.");
        return;
      }
      setUrl(`${location.origin}/share/${d.share.token}`);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!open) {
    return (
      <button className="ui-btn ui-btn-ghost" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className="ui-share">
      <h3>🔗 공유하기</h3>

      {kind === "essay" ? (
        <p className="ui-hint">
          <strong>이 문항의 회사·직무·문항·본문만</strong> 보입니다. 다른 문항, 내 경험,
          회사 메모, 마감일, 첨삭 점수는 함께 나가지 않아요.
        </p>
      ) : (
        <p className="ui-hint">
          <strong>최종 결과물만</strong> 보입니다. 중간 과정과 단계별 기록은 나가지 않아요.
        </p>
      )}

      <div className="ui-actions">
        <button
          type="button"
          className="ui-chip"
          aria-pressed={scope === "login"}
          onClick={() => setScope("login")}
        >
          🔒 로그인한 사람만
        </button>
        <button
          type="button"
          className="ui-chip"
          aria-pressed={scope === "link"}
          onClick={() => setScope("link")}
        >
          🔗 링크 아는 사람 누구나
        </button>
      </div>

      {/* 링크를 주는 것과 거실에 내놓는 것은 다른 결정이라 따로 묻는다 */}
      <div className="ui-actions">
        <button
          type="button"
          className="ui-chip"
          aria-pressed={listed}
          onClick={() => setListed((v) => !v)}
        >
          🛋️ 거실에 올리기
        </button>
        <span className="ui-hint">
          {listed
            ? "거실 목록에 떠서 다른 사람이 찾아와 읽을 수 있어요."
            : "링크를 준 사람만 볼 수 있어요. 거실 목록엔 안 떠요."}
        </span>
      </div>

      {error && <p className="ui-note is-err">{error}</p>}

      {url ? (
        <>
          <input className="ui-input" value={url} readOnly onFocus={(e) => e.target.select()} />
          <div className="ui-actions">
            <button className="ui-btn" onClick={copy}>
              {copied ? "복사됨!" : "📋 링크 복사"}
            </button>
            <button className="ui-btn ui-btn-ghost" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
          <p className="ui-hint">공유를 끊고 싶으면 🛋️ 거실에서 해제할 수 있어요.</p>
        </>
      ) : (
        <div className="ui-actions">
          <button className="ui-btn" onClick={share} disabled={busy}>
            {busy ? "만드는 중…" : "링크 만들기"}
          </button>
          <button className="ui-btn ui-btn-ghost" onClick={() => setOpen(false)}>
            그만두기
          </button>
        </div>
      )}
    </div>
  );
}
