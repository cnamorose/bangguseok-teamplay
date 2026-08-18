"use client";

import Loading from "@/app/components/Loading";

import { useEffect, useState } from "react";

// 거실 — 두 방에서 내놓은 것이 모이는 자리.
//
// 예전엔 내가 만든 링크 목록(복사·해제 버튼)만 있어서 설정 화면처럼 보였다.
// 커뮤니티가 되려면 남이 내놓은 것이 보여야 하므로 두 탭으로 나눈다.
//   🛋️ 거실   — 모두가 올린 글 (읽고 댓글 달러 가는 곳)
//   📋 내 공유 — 내가 만든 링크 관리 (올리기/내리기·복사·해제)
//
// 거실에 뜨는 건 listed를 켠 것뿐이다. 링크만 준 글은 목록에 안 나온다.

interface FeedRow {
  id: string;
  token: string;
  kind: string;
  snapshot: { topic?: string; companyName?: string; role?: string; prompt?: string };
  createdAt: string;
  author: string;
  mine: boolean;
  comments: number;
}

interface MineRow {
  id: string;
  token: string;
  kind: string;
  snapshot: { topic?: string; companyName?: string; role?: string; prompt?: string };
  scope: string;
  listed: boolean;
  revoked: boolean;
  createdAt: string;
  _count: { comments: number };
}

type Tab = "feed" | "mine";

const KIND_LABEL: Record<string, string> = {
  essay: "💼 자기소개서",
  result: "📚 공부방 결과물",
};

function titleOf(s: FeedRow["snapshot"], kind: string) {
  if (kind === "essay") {
    const parts = [s.companyName, s.role].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "자기소개서";
  }
  return s.topic ?? "제목 없음";
}

// "3분 전" 같은 표시. 커뮤니티는 언제 올라왔는지가 크게 보여야 한다.
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

export default function LivingRoom() {
  const [tab, setTab] = useState<Tab>("feed");
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [mine, setMine] = useState<MineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/share?feed=1").then((r) => r.json()),
      fetch("/api/share").then((r) => r.json()),
    ])
      .then(([f, m]) => {
        if (f.error || m.error) {
          setError(f.error || m.error);
          return;
        }
        setFeed(f.shares);
        setMine(m.shares);
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

  const setListed = async (token: string, listed: boolean) => {
    setBusy(token);
    await fetch(`/api/share/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listed }),
    });
    setBusy(null);
    load();
  };

  const revoke = async (token: string) => {
    setBusy(token);
    await fetch(`/api/share/${token}`, { method: "DELETE" });
    setBusy(null);
    load();
  };

  if (loading) return <Loading label="거실을 둘러보는 중…" />;
  if (error) return <p className="ui-note is-err">{error}</p>;

  const live = mine.filter((s) => !s.revoked);

  return (
    <>
      <header className="ui-head">
        <h1>거실</h1>
        <p>두 방에서 내놓은 것이 여기 모여요. 읽고 댓글을 남길 수 있어요.</p>
      </header>

      <div className="ui-bar">
        <div className="ui-tabs" role="tablist" aria-label="보기 전환">
          <button role="tab" aria-selected={tab === "feed"} onClick={() => setTab("feed")}>
            🛋️ 거실 <em>{feed.length}</em>
          </button>
          <button role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>
            📋 내 공유 <em>{live.length}</em>
          </button>
        </div>
      </div>

      {tab === "feed" ? (
        feed.length === 0 ? (
          <div className="ui-empty">
            <h3>아직 거실이 조용해요</h3>
            <p>
              책장이나 자소서에서 <strong>🔗 공유</strong> → <strong>🛋️ 거실에 올리기</strong>를
              켜면 여기에 놓여요.
            </p>
          </div>
        ) : (
          <div className="ui-feed">
            {feed.map((s) => (
              <article className="ui-post" key={s.id}>
                <div className="ui-post-top">
                  <span className="ui-post-face">{s.author[0]?.toUpperCase()}</span>
                  <span className="ui-post-who">{s.author}</span>
                  {s.mine && <span className="ui-post-mine">나</span>}
                  <span className="ui-post-dot">·</span>
                  <span className="ui-post-when">{timeAgo(s.createdAt)}</span>
                  <span className="ui-post-tag">{KIND_LABEL[s.kind] ?? s.kind}</span>
                </div>

                <h3>
                  <a href={`/share/${s.token}`} target="_blank" rel="noopener noreferrer">
                    {titleOf(s.snapshot, s.kind)}
                  </a>
                </h3>
                {s.snapshot.prompt && <p className="ui-post-sub">{s.snapshot.prompt}</p>}

                <div className="ui-post-foot">
                  <span>💬 댓글 {s.comments}</span>
                  <a
                    className="ui-btn ui-btn-ghost"
                    style={{ marginLeft: "auto" }}
                    href={`/share/${s.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    읽고 댓글 달기
                  </a>
                </div>
              </article>
            ))}
          </div>
        )
      ) : live.length === 0 ? (
        <div className="ui-empty">
          <h3>아직 내놓은 게 없어요</h3>
          <p>
            책장이나 자소서에서 <strong>🔗 공유</strong>를 누르면 링크가 만들어져요.
          </p>
        </div>
      ) : (
        <div className="ui-feed">
          {live.map((s) => (
            <article className="ui-post" key={s.id}>
              <div className="ui-post-top">
                <span className="ui-post-when">{timeAgo(s.createdAt)}</span>
                {s.listed && <span className="ui-post-mine">🛋️ 거실에 올림</span>}
                <span className="ui-post-tag">{KIND_LABEL[s.kind] ?? s.kind}</span>
              </div>

              <h3>
                <a href={`/share/${s.token}`} target="_blank" rel="noopener noreferrer">
                  {titleOf(s.snapshot, s.kind)}
                </a>
              </h3>
              {s.snapshot.prompt && <p className="ui-post-sub">{s.snapshot.prompt}</p>}

              <div className="ui-post-foot">
                <span>{s.scope === "login" ? "🔒 로그인한 사람만" : "🔗 링크 아는 사람"}</span>
                <span>💬 {s._count.comments}</span>

                <button
                  className="ui-btn ui-btn-ghost"
                  style={{ marginLeft: "auto" }}
                  onClick={() => setListed(s.token, !s.listed)}
                  disabled={busy === s.token}
                >
                  {s.listed ? "거실에서 내리기" : "🛋️ 거실에 올리기"}
                </button>
                <button className="ui-btn ui-btn-ghost" onClick={() => copy(s.token)}>
                  {copied === s.token ? "복사됨!" : "링크 복사"}
                </button>
                <button
                  className="ui-btn ui-btn-ghost"
                  onClick={() => revoke(s.token)}
                  disabled={busy === s.token}
                >
                  공유 해제
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
