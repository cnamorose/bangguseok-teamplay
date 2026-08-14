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
        body: JSON.stringify({ kind, targetId, scope }),
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
      <button className="tp-btn-outline" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className="tp-share-box">
      <p className="tp-sub-title">🔗 공유하기</p>

      {kind === "essay" ? (
        <p className="tp-sub-desc" style={{ margin: 0 }}>
          <strong>이 문항의 회사·직무·문항·본문만</strong> 보입니다. 다른 문항, 내 경험,
          회사 메모, 마감일, 첨삭 점수는 함께 나가지 않아요.
        </p>
      ) : (
        <p className="tp-sub-desc" style={{ margin: 0 }}>
          <strong>최종 결과물만</strong> 보입니다. 중간 과정과 단계별 기록은 나가지 않아요.
        </p>
      )}

      <div className="tp-choices">
        <button
          type="button"
          className="tp-chip"
          aria-pressed={scope === "login"}
          onClick={() => setScope("login")}
        >
          🔒 로그인한 사람만
        </button>
        <button
          type="button"
          className="tp-chip"
          aria-pressed={scope === "link"}
          onClick={() => setScope("link")}
        >
          🔗 링크 아는 사람 누구나
        </button>
      </div>

      {error && <p className="tp-error">{error}</p>}

      {url ? (
        <>
          <input className="tp-input" value={url} readOnly onFocus={(e) => e.target.select()} />
          <div className="tp-choices">
            <button className="tp-btn" onClick={copy}>
              {copied ? "복사됨!" : "📋 링크 복사"}
            </button>
            <button className="tp-btn-outline" onClick={() => setOpen(false)}>닫기</button>
          </div>
          <p className="tp-sub-desc" style={{ margin: 0 }}>
            공유를 끊고 싶으면 🛋️ 거실에서 해제할 수 있어요.
          </p>
        </>
      ) : (
        <div className="tp-choices">
          <button className="tp-btn" onClick={share} disabled={busy}>
            {busy ? "만드는 중..." : "링크 만들기"}
          </button>
          <button className="tp-btn-outline" onClick={() => setOpen(false)}>그만두기</button>
        </div>
      )}
    </div>
  );
}
