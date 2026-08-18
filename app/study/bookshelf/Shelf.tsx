"use client";

import Loading from "@/app/components/Loading";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ColorTab from "@/app/components/ColorTab";
import { chiefScore, fmtDate, useShelfData } from "./useShelfData";

// 책장 — 만든 것이 책상 위에 놓인 물건처럼 보이게 한다.
// 인덱스 탭과 살짝 기울인 각도로 컨셉을 남기되, 글자는 크고 여백은 넉넉하게.

type View = "books" | "clips";

export default function Shelf() {
  const router = useRouter();
  const { results, clips, stats, loading, error, setColor } = useShelfData();
  const [view, setView] = useState<View>("books");
  const [q, setQ] = useState("");

  if (loading) return <Loading label="불러오는 중…" />;

  const key = q.trim().toLowerCase();
  const books = key
    ? results.filter(
        (r) =>
          r.topic.toLowerCase().includes(key) ||
          (r.assembly?.name ?? "").toLowerCase().includes(key)
      )
    : results;
  const clipList = key ? clips.filter((c) => c.topic.toLowerCase().includes(key)) : clips;

  return (
    <>
      <header className="ui-head">
        <h1>책장</h1>
        <p>
          {results.length}권
          {stats.avg !== null && ` · 평균 ${stats.avg}점`}
        </p>
      </header>

      <div className="ui-bar">
        <div className="ui-tabs" role="tablist" aria-label="보기 전환">
          <button role="tab" aria-selected={view === "books"} onClick={() => setView("books")}>
            결과물 <em>{results.length}</em>
          </button>
          <button role="tab" aria-selected={view === "clips"} onClick={() => setView("clips")}>
            평가단자료 <em>{clips.length}</em>
          </button>
        </div>

        <input
          className="ui-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={view === "books" ? "제목·팀 이름으로 찾기" : "주제로 찾기"}
          aria-label="검색"
        />

        <button
          className="ui-btn"
          style={{ marginLeft: "auto" }}
          onClick={() => router.push(view === "books" ? "/study/create" : "/study/evaluate")}
        >
          {view === "books" ? "새 책 만들기" : "평가 받기"}
        </button>
      </div>

      {error && <p className="ui-note is-err">{error}</p>}

      {view === "books" ? (
        results.length === 0 ? (
          <div className="ui-empty">
            <h3>책장이 비어 있어요</h3>
            <p>팀을 꾸려 첫 책을 만들어보세요.</p>
            <button className="ui-btn" onClick={() => router.push("/study/create")}>
              새 책 만들기
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="ui-empty">
            <h3>“{q.trim()}”에 맞는 책이 없어요</h3>
            <p>다른 말로 찾아보세요.</p>
          </div>
        ) : (
          <div className="ui-shelf">
            <button className="ui-book ui-book-new" onClick={() => router.push("/study/create")}>
              <span>＋</span>
              새 책 만들기
            </button>

            {books.map((r, i) => (
              <article
                key={r.id}
                className="ui-book"
                style={{ ["--tilt" as string]: `${(i % 3) - 1}deg` }}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/result/${r.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/result/${r.id}`)}
              >
                <ColorTab id={r.id} color={r.color} onPick={(c) => setColor(r.id, c)} />
                <h3>{r.topic}</h3>
                <p className="ui-book-sub">{r.assembly?.name}</p>
                <p className="ui-book-date">{fmtDate(r.createdAt)}</p>
              </article>
            ))}
          </div>
        )
      ) : clips.length === 0 ? (
        <div className="ui-empty">
          <h3>저장한 자료가 없어요</h3>
          <p>평가를 받고 클립보드에 저장하면 여기 꽂혀요.</p>
          <button className="ui-btn" onClick={() => router.push("/study/evaluate")}>
            평가 받기
          </button>
        </div>
      ) : (
        <div className="ui-clips">
          {clipList.map((c) => {
            const score = chiefScore(c.results);
            return (
              <article
                key={c.id}
                className="ui-clip"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/clipboard/${c.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/clipboard/${c.id}`)}
              >
                <span className="ui-clip-top" aria-hidden="true" />
                <h3>{c.topic}</h3>
                <p className="ui-score">
                  <b>{score ?? "—"}</b>
                  <span>/ 100</span>
                </p>
                <p className="ui-book-date">{fmtDate(c.createdAt)}</p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
