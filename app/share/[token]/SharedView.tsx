"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  author: string;
  mine: boolean;
}

interface ResultSnap {
  kind: "result";
  topic: string;
  teamName: string;
  body: string;
  createdAt: string;
}

interface EssaySnap {
  kind: "essay";
  companyName: string;
  role: string;
  prompt: string;
  kindLabel: string;
  maxChars: number | null;
  charCount: number;
  content: string;
}

interface ShareData {
  kind: string;
  snapshot: ResultSnap | EssaySnap;
  createdAt: string;
  owner: string;
  isOwner: boolean;
  canComment: boolean;
  comments: CommentRow[];
}

export default function SharedView({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needLogin, setNeedLogin] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => {
    fetch(`/api/share/${token}`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) {
          setError(d.error || "불러오지 못했습니다.");
          setNeedLogin(!!d.needLogin);
        } else setData(d.share);
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/share/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "댓글을 남기지 못했습니다.");
        return;
      }
      setDraft("");
      load();
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/share/${token}/comments?id=${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <p className="tp-note">불러오는 중...</p>;

  if (error) {
    return (
      <div className="tp-shelf-empty">
        <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
        <strong>{error}</strong>
        {needLogin && (
          <>
            <br />
            <button className="tp-btn" style={{ marginTop: 16 }} onClick={() => router.push("/login")}>
              로그인하러 가기
            </button>
          </>
        )}
      </div>
    );
  }

  if (!data) return null;
  const s = data.snapshot;

  return (
    <div className="tp-share-view">
      {/* 결과물 */}
      <article className="tp-share-doc">
        {s.kind === "result" ? (
          <>
            <p className="tp-share-eyebrow">📚 공부방 결과물</p>
            <h1 className="tp-share-title">{s.topic}</h1>
            <p className="tp-share-meta">
              {s.teamName && `${s.teamName} · `}
              {new Date(s.createdAt).toLocaleDateString("ko-KR")}
            </p>
            <div className="tp-share-body">{s.body}</div>
          </>
        ) : (
          <>
            <p className="tp-share-eyebrow">
              💼 자기소개서 {s.kindLabel && `· ${s.kindLabel}`}
            </p>
            <h1 className="tp-share-title">
              {s.companyName} <span>· {s.role}</span>
            </h1>
            <p className="tp-share-prompt">{s.prompt}</p>
            <p className="tp-share-meta">
              {s.charCount}자{s.maxChars ? ` / ${s.maxChars}` : ""}
            </p>
            <div className="tp-share-body">{s.content}</div>
          </>
        )}
        <p className="tp-share-owner">{data.owner} 님이 공유했어요</p>
      </article>

      {/* 댓글 */}
      <section className="tp-share-comments">
        <p className="tp-col-title">💬 댓글 {data.comments.length}</p>

        {data.comments.length === 0 && (
          <p className="tp-sub-desc" style={{ margin: 0 }}>
            아직 댓글이 없어요. 읽고 느낀 걸 남겨주세요.
          </p>
        )}

        {data.comments.map((c) => (
          <div className="tp-comment" key={c.id}>
            <div className="tp-comment-top">
              <strong>{c.author}</strong>
              <span>{new Date(c.createdAt).toLocaleDateString("ko-KR")}</span>
              {(c.mine || data.isOwner) && (
                <button className="tp-comment-del" onClick={() => remove(c.id)}>지우기</button>
              )}
            </div>
            <p className="tp-comment-body">{c.content}</p>
          </div>
        ))}

        {data.canComment ? (
          <>
            <textarea
              className="tp-textarea"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="어떤 점이 좋았는지, 어디가 걸리는지 적어주세요."
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <button className="tp-btn" onClick={send} disabled={!draft.trim() || sending}>
              {sending ? "남기는 중..." : "댓글 남기기"}
            </button>
          </>
        ) : (
          <div className="tp-sub">
            <p className="tp-sub-desc">댓글은 로그인해야 쓸 수 있어요.</p>
            <button className="tp-btn-outline" onClick={() => router.push("/login")}>
              로그인하기
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
