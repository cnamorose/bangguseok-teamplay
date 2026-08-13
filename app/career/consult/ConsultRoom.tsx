"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readSse } from "@/lib/sse-client";
import RubricBars from "@/app/components/RubricBars";
import DiffView from "@/app/components/DiffView";
import SegmentedToggle from "@/app/components/SegmentedToggle";
import { KINDS, guessKind } from "@/lib/agents/essay/kinds";

interface EvalResult {
  evaluatorId: string;
  evaluatorName: string;
  scoreLabel: string;
  score: number;
  maxScore: number;
  comment: string;
  breakdown?: { label: string; score: number; maxScore: number }[];
}

interface Point { where: string; problem: string; fix: string }

interface EssayRow {
  id: string;
  prompt: string;
  charCount: number;
  content: string;
  application: { role: string; company: { name: string } };
}

type Source = "saved" | "paste";

// 첨삭단 — 화면에 보여줄 정보 (프롬프트는 서버의 lib/evaluators.ts에)
const REVIEWERS = [
  { id: "recruiter", emoji: "👔", name: "인사담당관", role: "이 사람을 만나볼까?" },
  { id: "prompt", emoji: "📌", name: "문항 지킴이", role: "물어본 걸 답했나?" },
  { id: "experience", emoji: "🧰", name: "경험 대조관", role: "진짜 내가 한 일인가?" },
  { id: "stylist", emoji: "✍️", name: "문장 검수관", role: "AI 티가 나나?" },
];

export default function ConsultRoom() {
  const router = useRouter();

  const [source, setSource] = useState<Source>("saved");
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [essayId, setEssayId] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState("free");
  const [maxChars, setMaxChars] = useState("");
  const [text, setText] = useState("");
  const [opinion, setOpinion] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<EvalResult[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [revised, setRevised] = useState("");
  const [original, setOriginal] = useState("");

  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/career/essay/review")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setEssays(data.essays);
          if (data.essays.length > 0) setEssayId(data.essays[0].id);
          else setSource("paste");
        }
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const byId = (id: string) => results.find((r) => r.evaluatorId === id);
  const allDone = results.length === REVIEWERS.length;

  const run = async () => {
    setError("");
    setResults([]);
    setPoints([]);
    setRevised("");
    setPage(0);

    const body =
      source === "saved"
        ? { essayId, userOpinion: opinion }
        : {
            companyName, role, prompt, kind,
            maxChars: Number(maxChars) > 0 ? Number(maxChars) : undefined,
            text, userOpinion: opinion,
          };

    setOriginal(source === "saved" ? (essays.find((e) => e.id === essayId)?.content ?? "") : text);
    setRunning(true);
    setProgress("첨삭단을 부르는 중...");

    try {
      const res = await fetch("/api/career/essay/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok && res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setError(data.error || "첨삭에 실패했습니다.");
        setRunning(false);
        return;
      }

      await readSse(res, (event) => {
        if (event.type === "progress") setProgress(event.message);
        else if (event.type === "evaluation") setResults((prev) => [...prev, event.result]);
        else if (event.type === "points") setPoints(event.points ?? []);
        else if (event.type === "revision") setRevised(event.revised);
        else if (event.type === "error") setError(event.message);
      });

      setRunning(false);
    } catch {
      setError("서버 오류가 발생했습니다.");
      setRunning(false);
    }
  };

  if (loading) return <p className="tp-note">불러오는 중...</p>;

  // 넘겨 볼 페이지 (첨삭단 4 + 고칠 곳 + 바뀐 곳)
  const pages = [
    ...REVIEWERS.map((r) => ({ key: r.id, emoji: r.emoji })),
    { key: "points", emoji: "📋" },
    { key: "diff", emoji: "🔍" },
  ];
  const pageEnabled = (key: string) => {
    if (key === "points") return points.length > 0;
    if (key === "diff") return !!revised && !!original;
    return true;
  };
  const cur = Math.min(page, pages.length - 1);
  const curKey = pages[cur].key;

  const PAGE_LABEL: Record<string, string> = {
    recruiter: "👔 인사담당관",
    prompt: "📌 문항 지킴이",
    experience: "🧰 경험 대조관",
    stylist: "✍️ 문장 검수관",
    points: "📋 고칠 곳",
    diff: "🔍 바뀐 곳 (내 글 → 수정본)",
  };

  const enabledIdx = pages.map((_, i) => i).filter((i) => pageEnabled(pages[i].key));
  const prevIdx = [...enabledIdx].reverse().find((i) => i < cur);
  const nextIdx = enabledIdx.find((i) => i > cur);

  const canRun = source === "saved" ? !!essayId : !!(prompt.trim() && text.trim());
  const chars = source === "saved"
    ? (essays.find((e) => e.id === essayId)?.charCount ?? 0)
    : Array.from(text).length;

  return (
    <div className="tp-assemble">
      {/* ── 좌측: 첨삭할 글 ── */}
      <div className="tp-col">
        <SegmentedToggle
          ariaLabel="첨삭할 글 고르기"
          value={source}
          onChange={(v) => setSource(v)}
          options={[
            { value: "saved", label: "📋 저장된 문항" },
            { value: "paste", label: "📝 붙여넣기" },
          ]}
        />

        {source === "saved" ? (
          essays.length === 0 ? (
            <div className="tp-sub">
              <p className="tp-sub-desc">
                아직 작성된 문항이 없어요. 붙여넣기로 바로 받아볼 수 있습니다.
              </p>
              <button className="tp-btn-outline" onClick={() => router.push("/career/resume")}>
                ✍️ 자소서 쓰러 가기
              </button>
            </div>
          ) : (
            <label className="tp-field">
              <span className="tp-label">문항</span>
              <select className="tp-input" value={essayId} onChange={(e) => setEssayId(e.target.value)}>
                {essays.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.application.company.name} · {e.application.role} — {e.prompt.slice(0, 24)} ({e.charCount}자)
                  </option>
                ))}
              </select>
              <span className="tp-sub-desc" style={{ margin: 0 }}>
                이 문항에 쓴 경험과 대조해 <strong>지어낸 내용이 없는지</strong>까지 봅니다.
              </span>
            </label>
          )
        ) : (
          <>
            <div className="tp-two">
              <label className="tp-field">
                <span className="tp-label">회사 <span className="tp-optional">(선택)</span></span>
                <input className="tp-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="네이버" />
              </label>
              <label className="tp-field">
                <span className="tp-label">직무 <span className="tp-optional">(선택)</span></span>
                <input className="tp-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="백엔드 개발" />
              </label>
            </div>

            <label className="tp-field">
              <span className="tp-label">문항</span>
              <textarea
                className="tp-textarea"
                rows={2}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (e.target.value.trim()) setKind(guessKind(e.target.value));
                }}
                placeholder="예) 지원 동기와 입사 후 이루고 싶은 목표를 기술해 주십시오."
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <div className="tp-field">
              <span className="tp-label">유형 <span className="tp-optional">(자동 추측)</span></span>
              <div className="tp-choices">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" className="tp-chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="tp-field tp-field-grow">
              <span className="tp-label">
                자소서 내용 <span className="tp-optional">{chars > 0 && `· ${chars}자`}</span>
              </span>
              <textarea
                className="tp-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="써 둔 자소서를 그대로 붙여넣으세요."
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label className="tp-field">
              <span className="tp-label">글자수 제한 <span className="tp-optional">(선택)</span></span>
              <input className="tp-input" type="number" min={0} value={maxChars} onChange={(e) => setMaxChars(e.target.value)} placeholder="800" />
            </label>
          </>
        )}

        <label className="tp-field">
          <span className="tp-label">
            이건 꼭 살려주세요 <span className="tp-optional">(선택 · 첨삭보다 우선)</span>
          </span>
          <textarea
            className="tp-textarea"
            rows={2}
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            placeholder="예) 두 번째 문단의 캐싱 얘기는 꼭 남겨주세요"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </label>

        {error && <p className="tp-error">{error}</p>}

        <button className="tp-btn" onClick={run} disabled={!canRun || running}>
          {running ? "🔍 첨삭 중..." : "🔍 첨삭 받기"}
        </button>
        {running && <p className="tp-sub-desc" style={{ margin: 0 }}>{progress}</p>}
      </div>

      {/* ── 우측: 페이지로 넘겨 보기 ── */}
      <div className="tp-col tp-col-paged">
        <p className="tp-page-name">{PAGE_LABEL[curKey]}</p>

        <div className="tp-page-view">
          {/* 첨삭단 한 명 */}
          {REVIEWERS.some((r) => r.id === curKey) &&
            (() => {
              const rv = REVIEWERS.find((r) => r.id === curKey)!;
              const r = byId(rv.id);
              return (
                <div className={r ? "tp-judge tp-judge-done" : "tp-judge"}>
                  <div className="tp-judge-top">
                    <span className="tp-judge-face">{rv.emoji}</span>
                    <span className="tp-judge-id">
                      <span className="tp-judge-name">{rv.name}</span>
                      <span className="tp-judge-role">{rv.role}</span>
                    </span>
                    {r ? (
                      <span className="tp-judge-score">
                        {r.scoreLabel} {r.score}/{r.maxScore}
                      </span>
                    ) : (
                      <span className="tp-judge-wait">{running ? "보는 중" : "대기 중"}</span>
                    )}
                  </div>

                  {r ? (
                    <>
                      {r.breakdown && <RubricBars breakdown={r.breakdown} />}
                      <p className="tp-judge-body">{r.comment}</p>
                    </>
                  ) : running ? (
                    <div className="tp-judge-typing">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <p className="tp-judge-pending">글을 고르고 첨삭을 받아보세요.</p>
                  )}
                </div>
              );
            })()}

          {/* 고칠 곳 */}
          {curKey === "points" &&
            (points.length === 0 ? (
              <p className="tp-judge-pending">첨삭이 끝나면 고칠 곳이 여기 정리돼요.</p>
            ) : (
              <div className="tp-gaps">
                {points.map((p, i) => (
                  <div className="tp-gap" key={i}>
                    <p className="tp-gap-q">“{p.where}”</p>
                    <p className="tp-gap-why">{p.problem}</p>
                    <p className="tp-point-fix">→ {p.fix}</p>
                  </div>
                ))}
              </div>
            ))}

          {/* 바뀐 곳 + 수정본 */}
          {curKey === "diff" && revised && (
            <>
              <DiffView original={original} revised={revised} />
              <div className="tp-edit-head" style={{ marginTop: 14 }}>
                <p className="tp-sub-title" style={{ margin: 0 }}>✨ 수정본</p>
                <button className="tp-btn-sm" onClick={() => navigator.clipboard.writeText(revised)}>
                  📋 복사
                </button>
              </div>
              <div className="tp-essay-body">{revised}</div>
              <p className="tp-sub-desc" style={{ margin: 0 }}>
                그대로 내지 말고 한 번 소리 내어 읽어보세요. 어색한 곳이 내 말투가 아닌 곳입니다.
              </p>
            </>
          )}
        </div>

        {/* 하단 페이지네이션 */}
        <div className="tp-pager">
          <button
            type="button"
            className="tp-pager-arrow"
            onClick={() => prevIdx !== undefined && setPage(prevIdx)}
            disabled={prevIdx === undefined}
            aria-label="이전"
          >
            ‹
          </button>

          <div className="tp-pager-dots">
            {pages.map((p, i) => (
              <button
                key={p.key}
                type="button"
                className="tp-pager-dot"
                aria-current={i === cur}
                disabled={!pageEnabled(p.key)}
                onClick={() => setPage(i)}
                title={PAGE_LABEL[p.key]}
              >
                {p.emoji}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="tp-pager-arrow"
            onClick={() => nextIdx !== undefined && setPage(nextIdx)}
            disabled={nextIdx === undefined}
            aria-label="다음"
          >
            ›
          </button>
        </div>

        {allDone && !revised && running && (
          <p className="tp-sub-desc" style={{ margin: 0 }}>수정본을 만드는 중...</p>
        )}
      </div>
    </div>
  );
}
