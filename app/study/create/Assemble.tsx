"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import ColorSwatches from "@/app/components/ColorSwatches";
import { PERSONA_CATALOG, STAGES, WRITING_STYLES } from "@/lib/persona-catalog";
import { readSse } from "@/lib/sse-client";

// 새로 만들기 — 세 걸음으로 나눈다.
//   ① 무엇을 쓸까 (주제·디테일)  ② 누가 쓸까 (팀원 조립)  ③ 비평가
// 조립은 왼쪽 자리 / 오른쪽 카드로 나란히 둔다. 끌어다 놓으려면 둘이 같이 보여야 한다.

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

  // 책장에 꽂힐 때 달릴 인덱스 탭 색. null이면 자동 (id에서 뽑음)
  const [color, setColor] = useState<string | null>(null);

  // 주제 설정(구체화) 관련
  const [detail, setDetail] = useState(""); // 초점·관점·톤 등 세부 요청
  const [targetLength, setTargetLength] = useState(""); // 목표 글자수(공백 포함, 선택)
  const [related, setRelated] = useState<string[]>([]); // 관련 주제
  const [recommended, setRecommended] = useState<string[]>([]); // 추천(구체화) 주제
  const [refining, setRefining] = useState(false);
  const [topicConfirmed, setTopicConfirmed] = useState(false); // '주제 설정 완료' 눌렀는지
  const hasSuggestions = related.length > 0 || recommended.length > 0;

  // 주제를 바꾸면 설정 완료를 무효화 (다시 확정하게).
  // 디테일 요소는 보조라 바꿔도 확정 상태를 유지한다.
  const editTopic = (v: string) => {
    setTopic(v);
    setTopicConfirmed(false);
  };

  // 주제 구체화: LLM 1회 태워 관련/추천 주제 받아오기
  const handleRefine = async () => {
    setError("");
    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }
    setRefining(true);
    try {
      const res = await fetch("/api/topic/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "주제 구체화에 실패했습니다.");
        return;
      }
      setRelated(data.related || []);
      setRecommended(data.recommended || []);
    } catch {
      setError("주제 구체화에 실패했습니다.");
    } finally {
      setRefining(false);
    }
  };

  // 초기화: 추천 목록만 비움 (주제/디테일은 유지)
  const clearSuggestions = () => {
    setRelated([]);
    setRecommended([]);
  };

  // 추천 주제를 누르면 주제칸에 채운다
  const pickSuggestion = (s: string) => editTopic(s);

  // 주제 설정 완료 → 팀 실행하기 잠금 해제 (추천 목록은 정리해서 감춤)
  const confirmTopic = () => {
    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }
    setError("");
    clearSuggestions();
    setTopicConfirmed(true);
  };

  const selectPersona = (stage: string, personaId: string) => {
    setSelected((prev) => ({ ...prev, [stage]: personaId }));
    if (stage === "organize" && personaId !== "proofreader") {
      setWritingStyle("");
    }
  };

  // 데려온 팀원을 도로 뺀다 — 넣기만 되면 조립이 아니다
  const clearPersona = (stage: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[stage];
      return next;
    });
    if (stage === "organize") setWritingStyle("");
  };

  const pickedAt = (stage: string) =>
    PERSONA_CATALOG[stage].find((p) => p.id === selected[stage]);

  const handleRun = async () => {
    setError("");

    if (!topic.trim()) {
      setError("주제를 입력해주세요.");
      return;
    }
    if (!topicConfirmed) {
      setError("먼저 '주제 설정 완료'를 눌러주세요.");
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
    setProgressMessage("팀을 소집하는 중…");

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          detail,
          targetLength: Number(targetLength) > 0 ? Number(targetLength) : undefined,
          teamName,
          searchPersona: selected.search,
          generatePersona: selected.generate,
          organizePersona: selected.organize,
          visualizePersona: selected.visualize,
          organizeStyle: writingStyle,
          criticCount,
          color,
        }),
      });

      // 인증 실패 등 즉시 에러
      if (!res.ok && res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setError(data.error || "실행에 실패했습니다.");
        setLoading(false);
        return;
      }

      // SSE 스트림 읽기.
      // 완료·실패는 여기 담아두고 스트림이 닫힌 뒤에 처리한다
      // (콜백 안에서 화면을 옮기면 아직 읽는 중인 스트림을 두고 떠나게 된다)
      type Outcome = { resultId: string } | { error: string };
      let result: Outcome | undefined;

      await readSse(res, (event) => {
        if (event.type === "progress") {
          setProgressMessage(event.message);
        } else if (event.type === "done") {
          setCompletedStages((prev) => prev + 1);
        } else if (event.type === "complete") {
          result = { resultId: event.resultId };
        } else if (event.type === "error") {
          result = { error: event.message || "실행에 실패했습니다." };
        }
      });

      // 콜백 안에서 대입한 값이라 타입 좁히기가 안 먹어서 한 번 되짚어준다
      const outcome = result as Outcome | undefined;

      if (outcome && "resultId" in outcome) {
        router.push(`/result/${outcome.resultId}`);
        return;
      }
      if (outcome && "error" in outcome) {
        setError(outcome.error);
        setLoading(false);
        return;
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  // 다이나믹이라 단계 수가 가변 → 100%를 넘지 않게 캡
  const progressPercent = Math.min(
    100,
    Math.round((completedStages / PROGRESS_STAGES.length) * 100)
  );

  // 실행 중이면 진행바 화면
  if (loading) {
    return (
      <div className="ui-run">
        <p className="ui-run-msg">{progressMessage}</p>
        <div
          className="ui-progress"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="ui-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="ui-run-pct">{progressPercent}%</p>
        {error && <p className="ui-note is-err">{error}</p>}
      </div>
    );
  }

  // 팀이 다 찼는지 — 교정관을 골랐으면 문체까지 골라야 끝이다
  const teamReady =
    STAGES.every((s) => selected[s.key]) &&
    (selected.organize !== "proofreader" || !!writingStyle);

  // 비평가는 기본값(안 부름)이 있어서 안 건드려도 되므로 진행률에서 뺀다
  const donePercent = ((Number(topicConfirmed) + Number(teamReady)) / 2) * 100;

  const filled = STAGES.filter((s) => selected[s.key]).length;
  const fallbackTeamName = topic.trim() ? `${topic.trim()} 팀` : "우리 팀";
  // 네 명의 성격을 순서대로 이어 한 문장으로 만든다 (LLM 없이 문자열 조합)
  const teamTraits = STAGES.map((s) => pickedAt(s.key)?.trait).filter(Boolean);

  const steps = [
    { id: "step-topic", label: "무엇을 쓸까", done: topicConfirmed },
    { id: "step-team", label: "누가 쓸까", done: teamReady },
    { id: "step-critic", label: "비평가", optional: true },
  ];
  const nowIndex = steps.findIndex((s) => !s.optional && !s.done);

  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <nav
        className="ui-stepbar"
        aria-label="진행 단계"
        style={{ ["--done" as string]: `${donePercent}%` }}
      >
        <div className="ui-stepbar-in">
          {steps.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 && <span className="ui-stepbar-sep" aria-hidden="true" />}
              <button
                type="button"
                className="ui-stepgo"
                data-state={s.done ? "done" : i === nowIndex ? "now" : "todo"}
                aria-current={i === nowIndex ? "step" : undefined}
                onClick={() => go(s.id)}
              >
                <span className="ui-stepgo-n">{s.done ? "✓" : i + 1}</span>
                {s.label}
                {s.optional && " (선택)"}
              </button>
            </Fragment>
          ))}

          <button
            className="ui-btn ui-stepbar-run"
            onClick={handleRun}
            disabled={!topicConfirmed}
            title={!topicConfirmed ? "먼저 '주제 설정 완료'를 눌러주세요." : ""}
          >
            🚀 팀 실행하기
          </button>
        </div>
      </nav>

      <header className="ui-head">
        <h1>새로 만들기</h1>
        <p>주제를 정하고 팀을 꾸리면 글 한 편이 나와요.</p>
      </header>

      {/* ── ① 무엇을 쓸까 ── */}
      <section className="ui-sec ui-anchor" id="step-topic">
        <div className="ui-sec-head">
          <h2>① 무엇을 쓸까</h2>
          <p>큰 틀만 던져도 돼요</p>
        </div>

        <div className="ui-panel ui-form">
          <label className="ui-field">
            <span>주제</span>
            <input
              className="ui-input"
              value={topic}
              onChange={(e) => editTopic(e.target.value)}
              placeholder="예: 대학생의 아침 습관"
            />
            <p className="ui-hint">
              큰 틀만 적고 <strong>주제 구체화</strong>를 누르면, 관련·추천 주제를 뽑아드려요.
            </p>
          </label>

          <div className="ui-actions">
            {!hasSuggestions ? (
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={handleRefine}
                disabled={refining || !topic.trim()}
              >
                {refining ? "🔎 주제 뽑는 중…" : "✨ 주제 구체화"}
              </button>
            ) : (
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={clearSuggestions}
                disabled={refining}
              >
                ♻️ 초기화
              </button>
            )}
          </div>

          {/* 추천 결과 (클릭하면 주제칸에 채워짐) */}
          {recommended.length > 0 && (
            <div className="ui-field">
              <span>
                ⭐ 추천 주제 <em>(클릭하면 주제칸에 채워져요)</em>
              </span>
              <div className="ui-actions">
                {recommended.map((s, i) => (
                  <button
                    key={`r${i}`}
                    type="button"
                    className="ui-chip"
                    onClick={() => pickSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div className="ui-field">
              <span>🔗 관련 주제</span>
              <div className="ui-actions">
                {related.map((s, i) => (
                  <button
                    key={`l${i}`}
                    type="button"
                    className="ui-chip"
                    onClick={() => pickSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="ui-field">
            <span>
              디테일 요소 <em>(선택)</em>
            </span>
            <textarea
              className="ui-textarea"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="원하는 초점·관점·톤을 적어주세요. (예: 실천 팁 위주로, 20대 독자에게, 담백한 문체로)"
              rows={3}
            />
          </label>

          {/* 팀 이름은 ②에서 얼굴을 보면서 짓는다 */}
          <div className="ui-form-row">
            <label className="ui-field">
              <span>
                목표 글자수 <em>(선택 · 공백 포함 ±50자)</em>
              </span>
              <input
                className="ui-input"
                type="number"
                min={0}
                value={targetLength}
                onChange={(e) => setTargetLength(e.target.value)}
                placeholder="예: 1000 (비워두면 제한 없음)"
              />
            </label>

            <div className="ui-field">
              <span>
                책 색 <em>(선택 · 책장에서 이 색 탭으로 꽂혀요)</em>
              </span>
              <ColorSwatches value={color} onPick={setColor} />
            </div>
          </div>

          {/* 주제 설정 완료 (팀 실행하기 잠금 해제) */}
          <div className="ui-actions">
            <button
              type="button"
              className={topicConfirmed ? "ui-btn ui-btn-ghost" : "ui-btn"}
              onClick={confirmTopic}
              disabled={!topic.trim()}
            >
              {topicConfirmed ? "✅ 주제 설정 완료" : "📌 주제 설정 완료"}
            </button>
            {topicConfirmed && <span className="ui-hint">주제를 고치면 다시 눌러주세요.</span>}
          </div>
        </div>
      </section>

      {/* ── ② 누가 쓸까 ── */}
      <section className="ui-sec ui-anchor" id="step-team">
        <div className="ui-sec-head">
          <h2>② 누가 쓸까</h2>
          <p>카드를 끌어다 자리에 앉히세요 · 눌러서 뽑아도 돼요</p>
        </div>

        {/* 팀 명패 — 얼굴을 보면서 이름을 짓는 자리 */}
        <div className="ui-plate">
          <div className="ui-plate-row">
            <input
              className="ui-plate-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={`${fallbackTeamName} (이름을 지어주세요)`}
              aria-label="팀 이름"
            />
            <div className="ui-plate-faces" aria-hidden="true">
              {STAGES.map((stage) => {
                const picked = pickedAt(stage.key);
                return (
                  <span
                    key={stage.key}
                    className={picked ? "ui-plate-face" : "ui-plate-face is-empty"}
                    title={picked ? picked.name : `${stage.label} 비어 있음`}
                  >
                    {picked ? picked.emoji : "＋"}
                  </span>
                );
              })}
            </div>
            <span className="ui-plate-count">4명 중 {filled}명</span>
          </div>

          {teamReady && (
            <p className="ui-team-line">
              <strong>{teamName.trim() || fallbackTeamName}</strong> — {teamTraits.join(", ")}.
            </p>
          )}
        </div>

        <div className="ui-assemble">
          <div className="ui-seats">
            {STAGES.map((stage) => {
              const picked = pickedAt(stage.key);
              const isTarget = dragging?.stage === stage.key;
              return (
                <div
                  key={stage.key}
                  className={[
                    "ui-seat",
                    picked ? "is-filled" : "",
                    isTarget ? "can-drop" : "",
                    isTarget && overStage === stage.key ? "is-over" : "",
                  ]
                    .join(" ")
                    .trim()}
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
                  <span className="ui-seat-face">{picked ? picked.emoji : "👤"}</span>
                  <span className="ui-seat-t">
                    {/* 빈 자리는 단계가 이름이고, 채우면 사람이 이름이 된다 */}
                    <b className="ui-seat-name">
                      {picked ? picked.name : `${stage.order}단계 · ${stage.label}`}
                    </b>
                    {picked && (
                      <span className="ui-seat-stage">
                        {stage.order}단계 · {stage.label}
                      </span>
                    )}
                    <span className="ui-seat-line">
                      {picked ? `“${picked.line}”` : "여기로 데려오세요"}
                    </span>
                  </span>

                  {picked && (
                    <button
                      type="button"
                      className="ui-seat-x"
                      onClick={() => clearPersona(stage.key)}
                      aria-label={`${picked.name} 빼기`}
                      title="빼기"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ui-roster">
            {STAGES.map((stage) => (
              <div className="ui-roster-col" key={stage.key}>
                <h3>
                  {stage.order}단계 · {stage.label}
                </h3>

                {PERSONA_CATALOG[stage.key].map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    className={
                      dragging?.personaId === persona.id && dragging?.stage === stage.key
                        ? "ui-card is-dragging"
                        : "ui-card"
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
                    <span className="ui-card-face">{persona.emoji}</span>
                    <span className="ui-card-name">{persona.name}</span>
                    <span className="ui-card-line">&ldquo;{persona.line}&rdquo;</span>
                    <span className="ui-card-desc">{persona.description}</span>
                  </button>
                ))}

                {/* 교정관을 골랐을 때만 문체 선택 (정리 열 아래) */}
                {stage.key === "organize" && selected.organize === "proofreader" && (
                  <div className="ui-panel">
                    <h3>✏️ 어떤 문체로?</h3>
                    <div className="ui-actions">
                      {WRITING_STYLES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="ui-chip"
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
      </section>

      {/* ── ③ 비평가 (4단계와 별개의 독립 레이어) ── */}
      <section className="ui-sec ui-anchor" id="step-critic">
        <div className="ui-sec-head">
          <h2>③ 비평가를 부를까요</h2>
          <p>선택</p>
        </div>

        <div className="ui-panel">
          <p className="ui-hint">
            비평가가 초안을 검토하고, 부족하면 다시 쓰게 해요. 통과하거나 정한 인원수만큼
            검토하면 끝나요.
          </p>
          <div className="ui-actions" style={{ marginTop: 12 }}>
            {CRITIC_OPTIONS.map((opt) => (
              <button
                key={opt.n}
                type="button"
                className="ui-chip"
                aria-pressed={criticCount === opt.n}
                onClick={() => setCriticCount(opt.n)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <p className="ui-note is-err">{error}</p>}

      <div className="ui-actions is-end">
        {!topicConfirmed && (
          <span className="ui-hint">🔒 주제 설정을 완료하면 팀을 실행할 수 있어요.</span>
        )}
        <button
          className="ui-btn"
          onClick={handleRun}
          disabled={!topicConfirmed}
          title={!topicConfirmed ? "먼저 '주제 설정 완료'를 눌러주세요." : ""}
        >
          🚀 팀 실행하기
        </button>
      </div>
    </>
  );
}
