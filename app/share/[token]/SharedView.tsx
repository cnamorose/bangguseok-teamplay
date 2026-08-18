"use client";

import Loading from "@/app/components/Loading";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 공유된 결과물 한 편.
//
// 앱 껍데기(Shell) 밖에 있다 — 로그인 없이도 열려야 하기 때문이다.
// 그래서 밝기 설정을 직접 읽고, 틀도 .ui-page로 따로 세운다.
//
// 왼쪽 글 2 : 오른쪽 댓글 1. 댓글은 붙어서 따라오므로
// 긴 글을 읽어 내려가면서도 바로 반응할 수 있다.

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

const MODE_KEY = "tp-mode";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function SharedView({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needLogin, setNeedLogin] = useState(false);
  const [dark, setDark] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // 앱에서 고른 밝기를 따라간다 (처음 온 사람은 밝은 화면)
  useEffect(() => {
    setDark(localStorage.getItem(MODE_KEY) === "dark");
  }, []);

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

  const frame = (children: React.ReactNode) => (
    <div className="ui-page" data-mode={dark ? "dark" : "light"}>
      <div className="ui-page-in">{children}</div>
    </div>
  );

  if (loading) return frame(<Loading />);

  if (error && !data) {
    return frame(
      <div className="ui-empty">
        <h3>{error}</h3>
        {needLogin && (
          <button className="ui-btn" onClick={() => router.push("/login")}>
            로그인하러 가기
          </button>
        )}
      </div>
    );
  }

  if (!data) return null;
  const s = data.snapshot;

  return frame(
    <>
      <header className="ui-head">
        <h1>{s.kind === "result" ? s.topic : `${s.companyName} · ${s.role}`}</h1>
        <p>
          {s.kind === "result" ? "📚 공부방 결과물" : `💼 자기소개서${s.kindLabel ? ` · ${s.kindLabel}` : ""}`}
          {" · "}
          {data.owner} 님이 공유했어요
          {" · "}
          {timeAgo(data.createdAt)}
        </p>
      </header>

      <div className="ui-split">
        {/* ── 왼쪽: 공유된 글 ── */}
        <article className="ui-doc">
          {s.kind === "result" ? (
            <>
              {s.teamName && <p className="ui-hint">{s.teamName}</p>}
              <p className="ui-doc-body">{s.body}</p>
            </>
          ) : (
            <>
              <h2>{s.prompt}</h2>
              <p className="ui-hint" style={{ marginBottom: 16 }}>
                {s.charCount}자{s.maxChars ? ` / ${s.maxChars}자` : ""}
              </p>
              <p className="ui-doc-body">{s.content}</p>
            </>
          )}
        </article>

        {/* ── 오른쪽: 댓글 ── */}
        <aside className="ui-comments">
          <h2>💬 댓글 {data.comments.length}</h2>

          {data.comments.length === 0 && (
            <p className="ui-hint">아직 댓글이 없어요. 읽고 느낀 걸 남겨주세요.</p>
          )}

          {data.comments.map((c) => (
            <div className="ui-comment" key={c.id}>
              <div className="ui-comment-top">
                <b>{c.author}</b>
                <span>{timeAgo(c.createdAt)}</span>
                {(c.mine || data.isOwner) && (
                  <button className="ui-comment-del" onClick={() => remove(c.id)}>
                    지우기
                  </button>
                )}
              </div>
              <p>{c.content}</p>
            </div>
          ))}

          {error && <p className="ui-note is-err">{error}</p>}

          {data.canComment ? (
            <div className="ui-comment-write">
              <textarea
                className="ui-textarea"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="어떤 점이 좋았는지, 어디가 걸리는지 적어주세요."
              />
              <button className="ui-btn" onClick={send} disabled={!draft.trim() || sending}>
                {sending ? "남기는 중…" : "댓글 남기기"}
              </button>
            </div>
          ) : (
            <div className="ui-comment-write">
              <p className="ui-hint">댓글은 로그인해야 쓸 수 있어요.</p>
              <button className="ui-btn ui-btn-ghost" onClick={() => router.push("/login")}>
                로그인하기
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
