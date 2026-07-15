"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONA_CATALOG, STAGES, WRITING_STYLES } from "@/lib/persona-catalog";

// 진행 단계 정의 (진행바 계산용)
const PROGRESS_STAGES = ["search", "generate", "organize", "visualize", "file"];

export default function CreatePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 진행 상태
  const [progressMessage, setProgressMessage] = useState("");
  const [completedStages, setCompletedStages] = useState(0);

  const [writingStyle, setWritingStyle] = useState("");

  const [criticCount, setCriticCount] = useState(0); // 0 = 비평가 안 부름

  const selectPersona = (stage: string, personaId: string) => {
    setSelected((prev) => ({ ...prev, [stage]: personaId }));
    if (stage === "organize" && personaId !== "proofreader") {
      setWritingStyle("");
    }
  };

  const handleRun = async () => {
    setError("");

    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }
    if (STAGES.some((s) => !selected[s.key])) {
      setError("모든 단계에서 페르소나를 선택해주세요.");
      return;
    }
    if (selected.organize === "proofreader" && !writingStyle) {
      setError("교정관의 문체를 선택해주세요.");
      return;
    }

    setLoading(true);
    setCompletedStages(0);
    setProgressMessage("팀을 소집하는 중...");

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          searchPersona: selected.search,
          generatePersona: selected.generate,
          organizePersona: selected.organize,
          visualizePersona: selected.visualize,
          organizeStyle: writingStyle,
          criticCount,
        }),
      });

      // 인증 실패 등 즉시 에러
      if (!res.ok && res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setError(data.error || "실행에 실패했습니다.");
        setLoading(false);
        return;
      }

      // SSE 스트림 읽기
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // "data: {...}\n\n" 단위로 파싱
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // 마지막 미완성 조각은 남김

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "progress") {
            setProgressMessage(event.message);
          } else if (event.type === "done") {
            setCompletedStages((prev) => prev + 1);
          } else if (event.type === "complete") {
            router.push(`/result/${event.resultId}`);
            return;
          } else if (event.type === "error") {
            setError(event.message || "실행에 실패했습니다.");
            setLoading(false);
            return;
          }
        }
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const progressPercent = Math.round((completedStages / PROGRESS_STAGES.length) * 100);

  // 실행 중이면 진행바 화면
  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: "120px auto", padding: 20, textAlign: "center" }}>
        <h2 style={{ fontSize: 22, marginBottom: 32 }}>{progressMessage}</h2>

        {/* 진행바 */}
        <div style={{ background: "#eee", borderRadius: 999, height: 16, overflow: "hidden", marginBottom: 12 }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "#000",
              borderRadius: 999,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <p style={{ color: "#888", fontSize: 14 }}>{progressPercent}%</p>

        {error && <p style={{ color: "red", marginTop: 20 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>팀 조립하기</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        주제를 정하고, 각 단계의 팀원을 골라 나만의 팀플 에이전트를 만들어보세요.
      </p>

      <div style={{ marginBottom: 32 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>주제</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예: 대학생의 아침 습관"
          style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      {STAGES.map((stage) => (
        <div key={stage.key} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>
            {stage.order}. {stage.label}
          </h3>
          <div style={{ display: "flex", gap: 12 }}>
            {PERSONA_CATALOG[stage.key].map((persona) => {
              const isSelected = selected[stage.key] === persona.id;
              return (
                <button
                  key={persona.id}
                  onClick={() => selectPersona(stage.key, persona.id)}
                  style={{
                    flex: 1,
                    padding: 16,
                    border: isSelected ? "2px solid #000" : "1px solid #ddd",
                    background: isSelected ? "#f5f5f5" : "#fff",
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{persona.emoji}</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{persona.name}</div>
                  <div style={{ fontSize: 13, color: "#666" }}>{persona.description}</div>
                </button>
              );
            })}
          </div>

          {/* 교정관을 골랐을 때만 문체 선택 */}
          {stage.key === "organize" && selected.organize === "proofreader" && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: "#f9f9f9",
                borderRadius: 10,
                border: "1px dashed #ccc",
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: 12 }}>✏️ 어떤 문체로 다듬을까요?</p>
              <div style={{ display: "flex", gap: 8 }}>
                {WRITING_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setWritingStyle(s.id)}
                    style={{
                      flex: 1,
                      padding: 12,
                      border: writingStyle === s.id ? "2px solid #000" : "1px solid #ddd",
                      background: writingStyle === s.id ? "#f0f0f0" : "#fff",
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{s.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 비평가 옵션 (4단계와 별개의 독립 레이어) */}
      <div style={{ marginBottom: 28, padding: 20, background: "#faf8f5", borderRadius: 12, border: "1px solid #eee" }}>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>🎯 비평가를 부를까요? (선택)</h3>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
          비평가가 초안을 검토하고, 부족하면 다시 쓰게 해요. 통과하거나 정한 인원수만큼 검토하면 끝나요.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { n: 0, label: "안 부름" },
            { n: 1, label: "1명" },
            { n: 2, label: "2명" },
            { n: 3, label: "3명" },
          ].map((opt) => (
            <button
              key={opt.n}
              onClick={() => setCriticCount(opt.n)}
              style={{
                flex: 1,
                padding: 12,
                border: criticCount === opt.n ? "2px solid #000" : "1px solid #ddd",
                background: criticCount === opt.n ? "#000" : "#fff",
                color: criticCount === opt.n ? "#fff" : "#000",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      
      {error && <p style={{ color: "red", marginBottom: 16 }}>{error}</p>}

      <button
        onClick={handleRun}
        style={{
          width: "100%",
          padding: 16,
          background: "#000",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        팀 실행하기
      </button>
    </div>
  );
}