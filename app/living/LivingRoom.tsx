"use client";

import { useEffect, useState } from "react";

interface ShareRow {
  id: string;
  token: string;
  kind: string;
  snapshot: { topic?: string; companyName?: string; role?: string; prompt?: string };
  scope: string;
  revoked: boolean;
  createdAt: string;
  _count: { comments: number };
}

export default function LivingRoom() {
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    fetch("/api/share")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setShares(d.shares);
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const copy = (token: string) => {
    navigator.clipboard.writeText(`${location.origin}/share/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  const revoke = async (token: string) => {
    await fetch(`/api/share/${token}`, { method: "DELETE" });
    load();
  };

  if (loading) return <p className="tp-note">거실을 둘러보는 중...</p>;
  if (error) return <p className="tp-note tp-note-error">{error}</p>;

  const live = shares.filter((s) => !s.revoked);

  if (live.length === 0) {
    return (
      <div className="tp-shelf-empty">
        <div style={{ fontSize: 34, marginBottom: 8 }}>🛋️</div>
        <strong>아직 내놓은 게 없어요</strong>
        <br />
        책장이나 자소서에서 <strong>🔗 공유</strong>를 누르면 여기에 놓입니다.
        <br />
        링크를 받은 사람이 읽고 댓글을 남길 수 있어요.
      </div>
    );
  }

  const books = live.filter((s) => s.kind === "result").length;
  const essays = live.filter((s) => s.kind === "essay").length;

  return (
    <div className="tp-career-col">
      <p className="tp-sub-desc" style={{ margin: 0 }}>
        두 방에서 내놓은 것이 여기 모입니다 —{" "}
        {books > 0 && `📚 공부방 ${books}개`}
        {books > 0 && essays > 0 && " · "}
        {essays > 0 && `💼 취업방 ${essays}개`}
        . 링크를 받은 사람이 읽고 댓글을 남길 수 있어요.
      </p>

      <div className="tp-company-grid">
        {live.map((s) => {
          const title =
            s.kind === "essay"
              ? `${s.snapshot.companyName ?? ""} · ${s.snapshot.role ?? ""}`
              : (s.snapshot.topic ?? "제목 없음");

          return (
            <div className="tp-company-card" key={s.id} style={{ cursor: "default" }}>
              <p className="tp-share-eyebrow">
                {s.kind === "essay" ? "💼 자기소개서" : "📚 공부방 결과물"}
              </p>
              <h3 className="tp-company-name">{title}</h3>
              {s.snapshot.prompt && <p className="tp-exp-sub">{s.snapshot.prompt}</p>}

              <div className="tp-share-tags">
                <span className="tp-role-chip">
                  {s.scope === "login" ? "🔒 로그인한 사람만" : "🔗 링크 아는 사람"}
                </span>
                {s._count.comments > 0 && (
                  <span className="tp-role-chip">💬 {s._count.comments}</span>
                )}
              </div>

              <div className="tp-choices">
                <a className="tp-btn-sm" href={`/share/${s.token}`} target="_blank" rel="noopener noreferrer">
                  열어보기
                </a>
                <button className="tp-btn-sm tp-btn-outline" onClick={() => copy(s.token)}>
                  {copied === s.token ? "복사됨!" : "링크 복사"}
                </button>
                <button className="tp-btn-sm tp-btn-outline" onClick={() => revoke(s.token)}>
                  공유 해제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
