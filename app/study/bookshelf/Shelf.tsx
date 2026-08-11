"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOK_COUNT } from "@/lib/theme";

interface ResultItem {
  id: string;
  topic: string;
  createdAt: string;
  assembly: { name: string };
}

interface ClipItem {
  id: string;
  topic: string;
  createdAt: string;
  results: { evaluatorId: string; score: number; maxScore: number }[] | null;
}

type View = "books" | "clips";

// 평가단자료 카드에 보여줄 종합(평가원) 점수
function chiefScore(results: ClipItem["results"]): number | null {
  if (!Array.isArray(results)) return null;
  const chief = results.find((r) => r?.evaluatorId === "chief");
  return chief && typeof chief.score === "number" ? chief.score : null;
}

// id를 해시해서 책 색을 고른다. 실제 색은 테마별 CSS 변수(--book-N)라
// 테마를 바꾸면 책 색도 함께 바뀐다. 책마다 색이 고정되도록 id에서 뽑는다
// (Math.random()은 새로고침·SSR 불일치 때문에 쓰지 않는다).
function coverColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `var(--book-${(Math.abs(hash) % BOOK_COUNT) + 1})`;
}

// 한 선반에 6권씩 나눠 담기
const PER_SHELF = 6;

function chunk<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

export default function Shelf() {
  const router = useRouter();
  const [view, setView] = useState<View>("books");

  const [results, setResults] = useState<ResultItem[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [clipsLoaded, setClipsLoaded] = useState(false);

  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // 책장(결과물)은 진입 시 로드
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/results", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setResults(data.results);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError("책장을 불러오지 못했습니다.");
      })
      .finally(() => setLoadingBooks(false));
    return () => controller.abort();
  }, []);

  // 평가단자료는 탭을 처음 열 때만 로드 (필요할 때 가져오기)
  const loadClips = () => {
    setLoadingClips(true);
    setError("");
    fetch("/api/evaluations")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setClips(data.evaluations);
        setClipsLoaded(true);
      })
      .catch(() => setError("평가단자료를 불러오지 못했습니다."))
      .finally(() => setLoadingClips(false));
  };

  const switchView = (v: View) => {
    setView(v);
    setQuery("");
    setError("");
    if (v === "clips" && !clipsLoaded) loadClips();
  };

  const q = query.trim().toLowerCase();
  const filteredBooks = q
    ? results.filter(
        (item) =>
          item.topic.toLowerCase().includes(q) ||
          item.assembly.name.toLowerCase().includes(q)
      )
    : results;
  const filteredClips = q
    ? clips.filter((c) => c.topic.toLowerCase().includes(q))
    : clips;

  const loading = view === "books" ? loadingBooks : loadingClips;
  const count = view === "books" ? filteredBooks.length : filteredClips.length;
  const unit = view === "books" ? "권" : "개";

  // 슬라이딩 인디케이터: 활성 탭의 실제 위치·너비를 측정해 맞춘다 (라벨 길이 달라도 정확)
  const booksTabRef = useRef<HTMLButtonElement>(null);
  const clipsTabRef = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = view === "books" ? booksTabRef.current : clipsTabRef.current;
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view]);

  return (
    <>
      {/* 검색바 + 뷰 드롭다운 + 만들기 버튼 (항상 노출 → 뷰 전환 가능) */}
      <div className="tp-shelf-bar">
        <div className="tp-view-toggle" role="tablist" aria-label="보기 전환">
          {thumb && (
            <span
              className="tp-view-toggle-thumb"
              style={{ left: thumb.left, width: thumb.width }}
              aria-hidden="true"
            />
          )}
          <button
            ref={booksTabRef}
            type="button"
            role="tab"
            aria-selected={view === "books"}
            className={`tp-view-toggle-btn${view === "books" ? " is-active" : ""}`}
            onClick={() => switchView("books")}
          >
            📚 책장
          </button>
          <button
            ref={clipsTabRef}
            type="button"
            role="tab"
            aria-selected={view === "clips"}
            className={`tp-view-toggle-btn${view === "clips" ? " is-active" : ""}`}
            onClick={() => switchView("clips")}
          >
            📋 평가단자료
          </button>
        </div>

        <div className="tp-search">
          <span className="tp-search-icon" aria-hidden="true">🔍</span>
          <input
            className="tp-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "books" ? "제목이나 팀 이름으로 찾기" : "주제로 찾기"}
            aria-label="검색"
          />
          {q && <span className="tp-search-count">{count}{unit}</span>}
        </div>

        <button
          className="tp-btn-sm"
          onClick={() => router.push(view === "books" ? "/study/create" : "/study/evaluate")}
          style={{ marginLeft: "auto" }}
        >
          {view === "books" ? "📖 새 책 만들기" : "🧑‍⚖️ 평가 받으러"}
        </button>
      </div>

      {loading && (
        <p className="tp-note">
          {view === "books" ? "책장을 불러오는 중..." : "평가단자료를 불러오는 중..."}
        </p>
      )}
      {error && <p className="tp-note tp-note-error">{error}</p>}

      {/* ── 책장 뷰 ── */}
      {view === "books" && !loadingBooks && !error && (
        <>
          {results.length === 0 ? (
            <div className="tp-shelf-empty">
              아직 책장에 꽂힌 팀플이 없어요.
              <br />첫 팀플을 만들어 책장을 채워보세요!
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="tp-shelf-empty">
              &ldquo;{query.trim()}&rdquo; 에 맞는 책이 없어요.
            </div>
          ) : (
            <div className="tp-display">
              {chunk(filteredBooks, PER_SHELF).map((row, i) => (
                <div className="tp-shelf-unit" key={i}>
                  <div className="tp-shelf-row">
                    {row.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="tp-book-cover"
                        style={{ background: coverColor(item.id) }}
                        onClick={() => router.push(`/result/${item.id}`)}
                      >
                        <div className="tp-book-label">
                          <h3 className="tp-book-title">{item.topic}</h3>
                        </div>
                        <p className="tp-book-meta">
                          {item.assembly.name}
                          <br />
                          {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="tp-plank" />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 평가단자료(클립보드) 뷰 ── */}
      {view === "clips" && !loadingClips && !error && (
        <>
          {clips.length === 0 ? (
            <div className="tp-shelf-empty">
              아직 저장한 평가단자료가 없어요.
              <br />평가단에서 평가 후 “클립보드에 저장”을 눌러보세요!
            </div>
          ) : filteredClips.length === 0 ? (
            <div className="tp-shelf-empty">
              &ldquo;{query.trim()}&rdquo; 에 맞는 자료가 없어요.
            </div>
          ) : (
            <div className="tp-clip-grid">
              {filteredClips.map((c) => {
                const score = chiefScore(c.results);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="tp-clip"
                    onClick={() => router.push(`/clipboard/${c.id}`)}
                  >
                    <span className="tp-clip-hang" aria-hidden="true" />
                    <h3 className="tp-clip-title">{c.topic}</h3>
                    <div className="tp-clip-score">
                      종합 <strong>{score ?? "—"}</strong>
                      <span> / 100</span>
                    </div>
                    <p className="tp-clip-date">
                      {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
