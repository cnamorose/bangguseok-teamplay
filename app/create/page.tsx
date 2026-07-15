"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONA_CATALOG, STAGES } from "@/lib/persona-catalog";

export default function CreatePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 특정 단계에서 페르소나 선택
  const selectPersona = (stage: string, personaId: string) => {
    setSelected((prev) => ({ ...prev, [stage]: personaId }));
  };

  const handleRun = async () => {
    setError("");

    // 검증: 주제 + 4단계 모두 선택됐는지
    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }
    if (STAGES.some((s) => !selected[s.key])) {
      setError("모든 단계에서 페르소나를 선택해주세요.");
      return;
    }

    setLoading(true);
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "실행에 실패했습니다.");
        return;
      }

      // 성공하면 결과 페이지로 이동 (나중에 만들 예정)
      router.push(`/result/${data.resultId}`);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>팀 조립하기</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        주제를 정하고, 각 단계의 팀원을 골라 나만의 팀플 에이전트를 만들어보세요.
      </p>

      {/* 주제 입력 */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>주제</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예: 대학생의 아침 습관"
          style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>

      {/* 단계별 페르소나 선택 */}
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
        </div>
      ))}

      {error && <p style={{ color: "red", marginBottom: 16 }}>{error}</p>}

      <button
        onClick={handleRun}
        disabled={loading}
        style={{
          width: "100%",
          padding: 16,
          background: loading ? "#999" : "#000",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 16,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "팀이 작업 중입니다... (최대 1분)" : "팀 실행하기"}
      </button>
    </div>
  );
}