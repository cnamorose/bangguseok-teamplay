"use client";

import { useState } from "react";

interface EvalResult {
  evaluatorId: string;
  evaluatorName: string;
  scoreLabel: string;
  score: number;
  maxScore: number;
  comment: string;
  sources?: string[];
}

export default function EvaluatePage() {
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<EvalResult[]>([]);
  const [error, setError] = useState("");

  const handleEvaluate = async () => {
    setError("");
    if (!topic.trim() || !text.trim()) {
      setError("주제와 글을 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    setResults([]);
    setProgress("평가단을 소집하는 중...");

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, text }),
      });

      if (!res.ok && res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setError(data.error || "평가에 실패했습니다.");
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "progress") {
            setProgress(event.message);
          } else if (event.type === "evaluation") {
            setResults((prev) => [...prev, event.result]);
          } else if (event.type === "complete") {
            setLoading(false);
          } else if (event.type === "error") {
            setError(event.message);
            setLoading(false);
          }
        }
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>평가 받기</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        내가 쓴 글을 평가단에게 보여주고, 항목별 점수와 피드백을 받아보세요.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>주제</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예: 군중심리의 이해"
          style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>글</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="평가받을 글을 붙여넣으세요."
          rows={12}
          style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 8, resize: "vertical" }}
        />
      </div>

      {error && <p style={{ color: "red", marginBottom: 16 }}>{error}</p>}

      <button
        onClick={handleEvaluate}
        disabled={loading}
        style={{
          width: "100%", padding: 16,
          background: loading ? "#999" : "#000",
          color: "#fff", border: "none", borderRadius: 10, fontSize: 16,
          cursor: loading ? "default" : "pointer",
          marginBottom: 24,
        }}
      >
        {loading ? progress : "평가 받기"}
      </button>

      {/* 평가 결과 (하나씩 도착) */}
      {results.map((r) => (
        <div key={r.evaluatorId} style={{ marginBottom: 16, padding: 20, border: "1px solid #eee", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 17 }}>{r.evaluatorName}</strong>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {r.scoreLabel} {r.score}/{r.maxScore}
            </span>
          </div>
          <p style={{ lineHeight: 1.7, color: "#333" }}>{r.comment}</p>
          {r.sources && r.sources.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>참고한 자료</p>
              <ul style={{ fontSize: 13, color: "#666" }}>
                {r.sources.map((s, i) => {
                  const match = s.match(/^(.*)\s\((https?:\/\/[^)]+)\)$/);
                  return (
                    <li key={i}>
                      {match ? (
                        <a href={match[2]} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>
                          {match[1]}
                        </a>
                      ) : s}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}