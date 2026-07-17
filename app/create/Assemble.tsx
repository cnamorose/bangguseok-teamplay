"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONA_CATALOG, STAGES, WRITING_STYLES } from "@/lib/persona-catalog";

// 진행 단계 정의 (진행바 계산용)
const PROGRESS_STAGES = ["search", "generate", "organize", "visualize", "file"];

const CRITIC_OPTIONS = [
  { n: 0, label: "안 부름" },
  { n: 1, label: "1명" },
  { n: 2, label: "2명" },
  { n: 3, label: "3명" },
];

export default function Assemble() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 드래그앤드롭 상태 (카드를 집으면 어느 단계의 누구인지)
  const [dragging, setDragging] = useState<{ stage: string; personaId: string } | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

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
      setError("모든 단계에 팀원을 채워주세요.");
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
          teamName,
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
      <div className="tp-progress-wrap">
        <p className="tp-progress-msg">{progressMessage}</p>
        <div className="tp-progress-bar">
          <div className="tp-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="tp-progress-pct">{progressPercent}%</p>
        {error && <p className="tp-note tp-note-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="tp-assemble">
      {/* ── 좌측: 팀 이름 + 주제 + 단계 소켓 + 비평가 + 실행 ── */}
      <div className="tp-col">
        <label className="tp-field">
          <span className="tp-label">팀 이름</span>
          <input
            className="tp-input"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder={topic.trim() ? `${topic.trim()} 팀` : "예: 새벽반 탐구대"}
          />
        </label>

        <label className="tp-field">
          <span className="tp-label">주제</span>
          <input
            className="tp-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 대학생의 아침 습관"
          />
        </label>

        <div className="tp-stages">
          <p className="tp-col-title">단계별 팀원</p>
          {STAGES.map((stage) => {
            const picked = PERSONA_CATALOG[stage.key].find(
              (p) => p.id === selected[stage.key]
            );
            const isTarget = dragging?.stage === stage.key;
            return (
              <div
                key={stage.key}
                className={[
                  picked ? "tp-slot tp-slot-filled" : "tp-slot",
                  isTarget ? "tp-drop-ok" : "",
                  isTarget && overStage === stage.key ? "tp-drop-over" : "",
                ].join(" ").trim()}
                onDragOver={(e) => {
                  if (isTarget) {
                    e.preventDefault(); // 드롭 허용
                    e.dataTransfer.dropEffect = "copy";
                    setOverStage(stage.key);
                  }
                }}
                onDragLeave={(e) => {
                  // 자식 요소로 들어간 경우는 무시
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && dragging.stage === stage.key) {
                    selectPersona(stage.key, dragging.personaId);
                  }
                  setDragging(null);
                  setOverStage(null);
                }}
              >
                <span className="tp-slot-num">{stage.order}</span>
                <span className="tp-slot-text">
                  <span className="tp-slot-label">{stage.label}</span>
                  {picked ? (
                    <span className="tp-slot-pick">
                      {picked.emoji} {picked.name}
                    </span>
                  ) : (
                    <span className="tp-slot-hint">여기로 끌어다 놓기</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* 비평가 옵션 (4단계와 별개의 독립 레이어) */}
        <div className="tp-sub">
          <p className="tp-sub-title">🎯 비평가를 부를까요? (선택)</p>
          <p className="tp-sub-desc">
            비평가가 초안을 검토하고, 부족하면 다시 쓰게 해요. 통과하거나 정한 인원수만큼
            검토하면 끝나요.
          </p>
          <div className="tp-choices">
            {CRITIC_OPTIONS.map((opt) => (
              <button
                key={opt.n}
                type="button"
                className="tp-chip"
                aria-pressed={criticCount === opt.n}
                onClick={() => setCriticCount(opt.n)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tp-spacer" />

        {error && <p className="tp-error">{error}</p>}

        <button className="tp-btn" onClick={handleRun}>
          🚀 팀 실행하기
        </button>
      </div>

      {/* ── 우측: 1~4단계 팀원 카드 전부 (가로 배치) ── */}
      <div className="tp-col">
        <p className="tp-col-title">
          팀원 카드 — 끌어다 왼쪽 단계에 꽂으세요 (눌러서 뽑아도 돼요)
        </p>

        <div className="tp-stage-grid">
          {STAGES.map((stage) => (
            <div className="tp-stage-col" key={stage.key}>
              <div className="tp-stage-col-head">
                {stage.order}단계 · {stage.label}
              </div>

              {PERSONA_CATALOG[stage.key].map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  className={
                    dragging?.personaId === persona.id && dragging?.stage === stage.key
                      ? "tp-mini-card tp-cast-dragging"
                      : "tp-mini-card"
                  }
                  aria-pressed={selected[stage.key] === persona.id}
                  onClick={() => selectPersona(stage.key, persona.id)}
                  draggable
                  onDragStart={(e) => {
                    // Firefox는 setData가 있어야 드래그가 시작됨
                    e.dataTransfer.setData("text/plain", persona.id);
                    e.dataTransfer.effectAllowed = "copy";
                    setDragging({ stage: stage.key, personaId: persona.id });
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOverStage(null);
                  }}
                >
                  <span className="tp-mini-face">{persona.emoji}</span>
                  <span className="tp-mini-name">{persona.name}</span>
                  <span className="tp-mini-line">&ldquo;{persona.line}&rdquo;</span>
                  <span className="tp-mini-desc">{persona.description}</span>
                </button>
              ))}

              {/* 교정관을 골랐을 때만 문체 선택 (정리 열 아래) */}
              {stage.key === "organize" && selected.organize === "proofreader" && (
                <div className="tp-sub tp-sub-tight">
                  <p className="tp-sub-title">✏️ 어떤 문체로?</p>
                  <div className="tp-choices">
                    {WRITING_STYLES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="tp-chip"
                        aria-pressed={writingStyle === s.id}
                        onClick={() => setWritingStyle(s.id)}
                        title={s.description}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
