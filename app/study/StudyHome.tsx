"use client";

import Loading from "@/app/components/Loading";

import { useRouter } from "next/navigation";
import { shelfColor } from "@/lib/shelf-color";
import { chiefScore, fmtDate, useShelfData } from "./bookshelf/useShelfData";

// 공부방 홈 — 로그인하면 제일 먼저 보이는 화면.
// 지금 상태를 위에서 한 번에 보여주고, 이어서 할 일을 권한다.

const JUDGES = [
  { emoji: "🎓", name: "평가원" },
  { emoji: "📚", name: "인간 도서관" },
  { emoji: "✍️", name: "글조합 천재" },
];

export default function StudyHome({ userName }: { userName: string }) {
  const router = useRouter();
  const { results, clips, stats, loading, error } = useShelfData();

  if (loading) return <Loading label="불러오는 중…" />;

  return (
    <>
      <header className="ui-head">
        <h1>안녕하세요, {userName}님</h1>
        <p>
          {results.length > 0
            ? `책장에 ${results.length}권이 꽂혀 있어요.`
            : "아직 첫 책을 만들기 전이에요."}
        </p>
      </header>

      {error && <p className="ui-note is-err">{error}</p>}

      <div className="ui-tiles">
        <div className="ui-tile">
          <span className="ui-tile-n">{results.length}</span>
          <span className="ui-tile-l">결과물</span>
        </div>
        <div className="ui-tile">
          <span className="ui-tile-n">{clips.length}</span>
          <span className="ui-tile-l">평가단자료</span>
        </div>
        <div className="ui-tile">
          <span className="ui-tile-n">
            {stats.avg ?? "—"}
            {stats.avg !== null && <em>/100</em>}
          </span>
          <span className="ui-tile-l">평균 점수</span>
        </div>
      </div>

      {stats.unrated > 0 && (
        <section className="ui-nudge">
          <p>
            <strong>평가를 안 받은 글이 {stats.unrated}편</strong> 있어요.
            평가단에게 보내면 어디를 고칠지 알려줘요.
          </p>
          <button className="ui-btn ui-btn-ghost" onClick={() => router.push("/study/evaluate")}>
            평가 받으러 가기
          </button>
        </section>
      )}

      {/* 평가단 — 캐릭터를 세워둔다 */}
      <section className="ui-cast">
        {JUDGES.map((j) => (
          <span className="ui-cast-one" key={j.name}>
            <span className="ui-face">{j.emoji}</span>
            {j.name}
          </span>
        ))}
        <button
          className="ui-btn"
          style={{ marginLeft: "auto" }}
          onClick={() => router.push("/study/evaluate")}
        >
          평가 받기
        </button>
      </section>

      <section className="ui-sec">
        <div className="ui-sec-head">
          <h2>최근 만든 것</h2>
          <button className="ui-more" onClick={() => router.push("/study/bookshelf")}>
            책장 전체 보기 →
          </button>
        </div>

        {results.length === 0 ? (
          <div className="ui-empty">
            <h3>책장이 비어 있어요</h3>
            <p>팀을 꾸려 첫 책을 만들어보세요.</p>
            <button className="ui-btn" onClick={() => router.push("/study/create")}>
              새 책 만들기
            </button>
          </div>
        ) : (
          <div className="ui-shelf">
            {results.slice(0, 5).map((r, i) => (
              <article
                key={r.id}
                className="ui-book"
                style={{ ["--tilt" as string]: `${(i % 3) - 1}deg` }}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/result/${r.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/result/${r.id}`)}
              >
                {/* 대시보드는 훑어보는 자리라 색만 보여준다 (고르기는 책장에서) */}
                <span className="ui-tab" style={{ background: shelfColor(r.id, r.color) }} />
                <h3>{r.topic}</h3>
                <p className="ui-book-sub">{r.assembly?.name}</p>
                <p className="ui-book-date">{fmtDate(r.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {clips.length > 0 && (
        <section className="ui-sec">
          <div className="ui-sec-head">
            <h2>평가단자료</h2>
            <button className="ui-more" onClick={() => router.push("/study/bookshelf")}>
              전체 보기 →
            </button>
          </div>

          <div className="ui-clips">
            {clips.slice(0, 4).map((c) => {
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
        </section>
      )}
    </>
  );
}
