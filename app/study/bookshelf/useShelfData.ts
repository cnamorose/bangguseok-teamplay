"use client";

import { useEffect, useMemo, useState } from "react";

export interface ResultItem {
  id: string;
  topic: string;
  /** 사용자가 고른 인덱스 탭 색 ("book-3") · null이면 id에서 뽑는다 */
  color: string | null;
  createdAt: string;
  assembly: { name: string } | null;
}

export interface ClipItem {
  id: string;
  topic: string;
  createdAt: string;
  results: { evaluatorId: string; score: number; maxScore: number }[] | null;
}

export function chiefScore(results: ClipItem["results"]): number | null {
  if (!Array.isArray(results)) return null;
  const chief = results.find((r) => r?.evaluatorId === "chief");
  return chief && typeof chief.score === "number" ? chief.score : null;
}

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

export function useShelfData() {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/results").then((r) => r.json()),
      fetch("/api/evaluations").then((r) => r.json()),
    ])
      .then(([a, b]) => {
        if (a.error) setError(a.error);
        else setResults(a.results);
        if (!b.error) setClips(b.evaluations);
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const scored = clips
      .map((c) => chiefScore(c.results))
      .filter((s): s is number => s !== null);
    const avg = scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;
    const topics = new Set(clips.map((c) => c.topic));
    const unrated = results.filter((r) => !topics.has(r.topic)).length;
    return { avg, unrated };
  }, [results, clips]);

  /** 인덱스 탭 색 바꾸기 — 화면을 먼저 바꾸고 서버에 알린다 */
  const setColor = (id: string, color: string | null) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, color } : r)));
    fetch(`/api/result/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    }).catch(() => {});
  };

  return { results, clips, stats, loading, error, setColor };
}
