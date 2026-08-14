"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseSource } from "@/lib/parse-source";
import RubricBars, { ScoreBreakdown } from "@/app/components/RubricBars";

// 평가단자료 한 건.
//
// 예전엔 평가 → 수정본 → 원본을 세로로 쌓아서, 글 두 편 길이만큼 스크롤해야 했다.
// 원본과 수정본은 같은 글의 두 판본이라 겹쳐 놓고 탭으로 바꿔 보는 게 맞다.
// 평가 화면과 같은 2단이라, 글을 보면서 평가를 읽을 수 있다.

interface EvalResult {
  evaluatorId: string;
  evaluatorName: string;
  scoreLabel: string;
  score: number;
  maxScore: number;
  comment: string;
  breakdown?: ScoreBreakdown[];
  sources?: string[];
}

interface ClipData {
  id: string;
  topic: string;
  text: string;
  revised: string | null;
  results: EvalResult[] | null;
  createdAt: string;
}

const EMOJI: Record<string, string> = {
  chief: "🎓",
  librarian: "📚",
  wordsmith: "✍️",
};

export default function ClipboardView({ id }: { id: string }) {
  const router = useRouter();
  const [clip, setClip] = useState<ClipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"text" | "revised">("text");

  useEffect(() => {
    fetch(`/api/evaluations/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setClip(data.evaluation);
      })
      .catch(() => setError("자료를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <p className="ui-note">불러오는 중…</p>;
  if (error) return <p className="ui-note is-err">{error}</p>;
  if (!clip) return null;

  const results = clip.results ?? [];
  // 수정본이 없으면 탭을 띄우지 않는다 (고를 게 하나뿐이면 고르는 자리가 필요 없다)
  const hasRevised = !!clip.revised;
  const shown = view === "revised" && clip.revised ? clip.revised : clip.text;
  const chars = Array.from(shown).length;

  return (
    <>
      <header className="ui-head is-row">
        <div>
          <h1>{clip.topic}</h1>
          <p>{new Date(clip.createdAt).toLocaleDateString("ko-KR")} · 평가단자료</p>
        </div>
        <button className="ui-btn ui-btn-ghost" onClick={() => router.push("/study/bookshelf")}>
          📚 책장으로
        </button>
      </header>

      <div className="ui-eval">
        {/* ── 왼쪽: 집게에 물린 글 (원본 ↔ 수정본) ── */}
        <div className="ui-cboard">
          <div className="ui-actions">
            {hasRevised ? (
              <div className="ui-tabs" role="tablist" aria-label="글 고르기">
                <button
                  role="tab"
                  aria-selected={view === "text"}
                  onClick={() => setView("text")}
                >
                  📝 내 글
                </button>
                <button
                  role="tab"
                  aria-selected={view === "revised"}
                  onClick={() => setView("revised")}
                >
                  ✨ 수정본
                </button>
              </div>
            ) : (
              <p className="ui-pagetitle">📝 평가받은 글</p>
            )}

            <button
              className="ui-btn ui-btn-ghost"
              style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12.5 }}
              onClick={() => copy(shown)}
            >
              {copied ? "복사됨!" : "📋 복사"}
            </button>
          </div>

          <div className="ui-sheet">
            <div className="ui-readbody">{shown}</div>
            <p className="ui-count">
              공백 포함 <strong>{chars.toLocaleString("ko-KR")}</strong>자
            </p>
          </div>
        </div>

        {/* ── 오른쪽: 평가단이 본 것 ── */}
        <div className="ui-evcol">
          <p className="ui-pagetitle">🏅 평가단이 본 것</p>

          <div className="ui-pagebody">
            {results.length === 0 ? (
              <div className="ui-empty">
                <h3>평가 기록이 없어요</h3>
                <p>저장될 때 평가 결과가 함께 담기지 않았어요.</p>
              </div>
            ) : (
              <div className="ui-judges">
                {results.map((r) => (
                  <article className="ui-judge is-done" key={r.evaluatorId}>
                    <div className="ui-judge-top">
                      <span className="ui-judge-face">{EMOJI[r.evaluatorId] ?? "🧑‍⚖️"}</span>
                      <span className="ui-judge-t">
                        <b>{r.evaluatorName}</b>
                        <span>{r.scoreLabel}</span>
                      </span>
                      <span className="ui-judge-score">
                        <b>{r.score}</b>
                        <span>/{r.maxScore}</span>
                      </span>
                    </div>

                    {r.breakdown && <RubricBars breakdown={r.breakdown} />}
                    <p className="ui-judge-body">{r.comment}</p>

                    {r.sources && r.sources.length > 0 && (
                      <div className="ui-srcs">
                        <p>참고한 자료</p>
                        <ul className="ui-list">
                          {r.sources.map((s, i) => {
                            const { title, url } = parseSource(s);
                            return (
                              <li key={i}>
                                {url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer">
                                    {title}
                                  </a>
                                ) : (
                                  s
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
