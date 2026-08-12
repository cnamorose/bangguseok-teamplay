"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseSource } from "@/lib/parse-source";
import RubricBars, { ScoreBreakdown } from "@/app/components/RubricBars";

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
  const [copied, setCopied] = useState<"text" | "revised" | null>(null);

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

  const copy = (which: "text" | "revised", value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) return <p className="tp-note">자료를 펼치는 중...</p>;
  if (error) return <p className="tp-note tp-note-error">{error}</p>;
  if (!clip) return null;

  const results = clip.results ?? [];

  return (
    <div className="tp-clipview">
      <div className="tp-clipview-head">
        <div>
          <h1 className="tp-clipview-title">{clip.topic}</h1>
          <p className="tp-clipview-date">
            {new Date(clip.createdAt).toLocaleDateString("ko-KR")} · 평가단자료
          </p>
        </div>
        <button className="tp-btn-outline" onClick={() => router.push("/study/bookshelf")}>
          📚 책장으로
        </button>
      </div>

      {/* 점수·코멘트 */}
      <div className="tp-clipview-scores">
        {results.map((r) => (
          <div className="tp-clipview-judge" key={r.evaluatorId}>
            <div className="tp-clipview-judge-top">
              <span className="tp-clipview-judge-face">{EMOJI[r.evaluatorId] ?? "🧑‍⚖️"}</span>
              <span className="tp-clipview-judge-name">{r.evaluatorName}</span>
              <span className="tp-clipview-judge-score">
                {r.scoreLabel} {r.score}/{r.maxScore}
              </span>
            </div>
            {r.breakdown && <RubricBars breakdown={r.breakdown} />}
            <p className="tp-clipview-judge-comment">{r.comment}</p>
            {r.sources && r.sources.length > 0 && (
              <ul className="tp-clipview-src">
                {r.sources.map((s, i) => {
                  const { title, url } = parseSource(s);
                  return (
                    <li key={i}>
                      {url ? (
                        <a className="tp-entry-link" href={url} target="_blank" rel="noopener noreferrer">
                          {title}
                        </a>
                      ) : (
                        s
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* 수정본 (있을 때) */}
      {clip.revised && (
        <div className="tp-clipview-block">
          <div className="tp-clipview-block-head">
            <strong>✨ 수정본</strong>
            <button className="tp-btn-sm" onClick={() => copy("revised", clip.revised!)}>
              {copied === "revised" ? "복사됨!" : "📋 복사"}
            </button>
          </div>
          <div className="tp-clipview-body">{clip.revised}</div>
        </div>
      )}

      {/* 평가받은 원본 글 */}
      <div className="tp-clipview-block">
        <div className="tp-clipview-block-head">
          <strong>📝 평가받은 글</strong>
          <button className="tp-btn-sm" onClick={() => copy("text", clip.text)}>
            {copied === "text" ? "복사됨!" : "📋 복사"}
          </button>
        </div>
        <div className="tp-clipview-body">{clip.text}</div>
      </div>
    </div>
  );
}
