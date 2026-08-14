"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readSse } from "@/lib/sse-client";
import { KINDS, guessKind } from "@/lib/agents/essay/kinds";
import { inspectAiTells } from "@/lib/agents/essay/ai-tells";
import ShareButton from "@/app/components/ShareButton";

interface ExpItem {
  id: string;
  title: string;
  role: string | null;
  impact: string | null;
  message: string | null;
  tags: string[];
  starred: boolean;
}

interface AppItem {
  id: string;
  role: string;
  company: { id: string; name: string; analysis: unknown };
  roleAnalysis: unknown;
  _count: { essays: number };
}

interface EssayItem {
  id: string;
  prompt: string;
  kind: string;
  maxChars: number | null;
  content: string;
  charCount: number;
  questions: { about: string; question: string }[] | null;
  usedExpIds: string[];
}

const kindLabel = (id: string) => KINDS.find((k) => k.id === id)?.label ?? id;

export default function ResumeRoom() {
  const router = useRouter();

  const [apps, setApps] = useState<AppItem[]>([]);
  const [exps, setExps] = useState<ExpItem[]>([]);
  const [essays, setEssays] = useState<EssayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [appId, setAppId] = useState("");

  // 문항 추가 폼
  const [newPrompt, setNewPrompt] = useState("");
  const [newKind, setNewKind] = useState("free");
  const [newMax, setNewMax] = useState("");

  // 문항별로 고른 경험 (문항마다 쓸 경험이 다르다)
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [tone, setTone] = useState<Record<string, string>>({});

  const [runningId, setRunningId] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const load = (application?: string) => {
    const q = application ? `?applicationId=${application}` : "";
    fetch(`/api/career/essay${q}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) return setError(data.error);
        setApps(data.applications);
        setExps(data.experiences);
        const list: EssayItem[] = data.essays ?? [];
        setEssays(list);
        setPicks((prev) => {
          const next = { ...prev };
          for (const e of list) if (!next[e.id]) next[e.id] = e.usedExpIds ?? [];
          return next;
        });
        if (!application && data.applications.length > 0) setAppId(data.applications[0].id);
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);
  useEffect(() => {
    if (appId) load(appId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  /** 한 경험이 여러 문항에 쓰이면 알려준다 — 같은 얘기를 반복하지 않게 */
  const overused = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of essays) {
      for (const id of picks[e.id] ?? []) count.set(id, (count.get(id) ?? 0) + 1);
    }
    return new Set([...count.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [essays, picks]);

  const tells = useMemo(() => inspectAiTells(draftText), [draftText]);

  const addQuestion = async () => {
    if (!newPrompt.trim()) return;
    setError("");
    const res = await fetch("/api/career/essay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: appId,
        prompt: newPrompt.trim(),
        kind: newKind,
        maxChars: Number(newMax) > 0 ? Number(newMax) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "문항을 추가하지 못했습니다.");
    setNewPrompt("");
    setNewMax("");
    setNewKind("free");
    load(appId);
  };

  const removeQuestion = async (id: string) => {
    await fetch(`/api/career/essay/${id}`, { method: "DELETE" });
    if (openId === id) setOpenId(null);
    load(appId);
  };

  const togglePick = (essayId: string, expId: string) => {
    setPicks((prev) => {
      const cur = prev[essayId] ?? [];
      const next = cur.includes(expId)
        ? cur.filter((x) => x !== expId)
        : cur.length >= 3
          ? cur
          : [...cur, expId];
      return { ...prev, [essayId]: next };
    });
  };

  const draft = async (essay: EssayItem) => {
    const picked = picks[essay.id] ?? [];
    if (picked.length === 0) {
      setError("이 문항에 쓸 경험을 골라주세요.");
      return;
    }
    setError("");
    setRunningId(essay.id);
    setProgress("초안을 준비하는 중...");

    try {
      const res = await fetch("/api/career/essay/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: appId,
          essayId: essay.id,
          prompt: essay.prompt,
          kind: essay.kind,
          maxChars: essay.maxChars ?? undefined,
          experienceIds: picked,
          tone: tone[essay.id] || undefined,
        }),
      });

      if (!res.ok && res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setError(data.error || "초안 작성에 실패했습니다.");
        setRunningId(null);
        return;
      }

      await readSse(res, (event) => {
        if (event.type === "progress") setProgress(event.message);
        else if (event.type === "complete") {
          setDraftText(event.essay.content);
          setOpenId(essay.id);
        } else if (event.type === "error") setError(event.message);
      });

      setRunningId(null);
      load(appId);
    } catch {
      setError("서버 오류가 발생했습니다.");
      setRunningId(null);
    }
  };

  const saveEdited = async (id: string) => {
    setSaveState("saving");
    await fetch(`/api/career/essay/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draftText }),
    });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1500);
    load(appId);
  };

  if (loading) return <p className="ui-note">불러오는 중…</p>;

  if (exps.length === 0) {
    return (
      <div className="ui-empty">
        <div style={{ fontSize: 34 }}>🧰</div>
        <h3>경험을 먼저 정리해주세요</h3>
        <p>
          자소서는 내 경험에서 나와요. 경험이 없으면 어느 회사에나 낼 수 있는 뻔한 글이 됩니다.
        </p>
        <button className="ui-btn" onClick={() => router.push("/career/experience")}>
          🧰 내 경험 정리하러 가기
        </button>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="ui-empty">
        <div style={{ fontSize: 34 }}>📄</div>
        <h3>먼저 지원 건을 만들어주세요</h3>
        <p>책상에서 회사와 채용공고를 넣으면 여기에 나타나요.</p>
        <button className="ui-btn" onClick={() => router.push("/career/desk")}>
          🗂️ 책상으로 가기
        </button>
      </div>
    );
  }

  if (runningId) {
    return (
      <div className="ui-run">
        <p className="ui-run-msg">{progress}</p>
        <div className="ui-progress">
          <span className="ui-progress-fill is-indet" />
        </div>
      </div>
    );
  }

  const current = apps.find((a) => a.id === appId);
  const written = essays.filter((e) => e.charCount > 0).length;

  return (
    <>
      <header className="ui-head">
        <h1>자소서 작성</h1>
        <p>
          {essays.length > 0
            ? `문항 ${essays.length}개 중 ${written}개 작성됨`
            : "공고의 문항을 옮겨 적고, 쓸 경험을 골라 초안을 뽑아요."}
        </p>
      </header>

      {/* 지원 건 */}
      <div className="ui-panel ui-form">
        <label className="ui-field">
          <span>어디에 낼 자소서인가요?</span>
          <select className="ui-input" value={appId} onChange={(e) => setAppId(e.target.value)}>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company.name} · {a.role} (문항 {a._count.essays}개)
              </option>
            ))}
          </select>
          {current && !current.company.analysis && (
            <p className="ui-hint">
              ⚠ 이 회사는 아직 기업 분석이 없어요. 분석해두면 회사에 맞는 문장이 나옵니다.
            </p>
          )}
        </label>
      </div>

      {/* 문항 목록 */}
      {essays.map((e, i) => {
        const picked = picks[e.id] ?? [];
        const isOpen = openId === e.id;

        return (
          <div className="ui-panel ui-form" key={e.id}>
            <div className="ui-actions">
              <span className="ui-step-n">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{e.prompt}</h3>
                <p className="ui-hint">
                  {kindLabel(e.kind)}
                  {e.maxChars ? ` · ${e.maxChars}자 이내` : ""}
                  {e.charCount > 0 && ` · 작성됨 ${e.charCount}자`}
                  {e.maxChars && e.charCount > e.maxChars && (
                    <strong style={{ color: "var(--danger)" }}> · 초과</strong>
                  )}
                </p>
              </div>
              <button
                className="ui-btn ui-btn-ghost"
                onClick={() => removeQuestion(e.id)}
                aria-label="문항 지우기"
              >
                🗑️
              </button>
            </div>

            {/* 이 문항에 쓸 경험 */}
            <div className="ui-field">
              <span>
                쓸 경험 <em>(최대 3개 · 한 문항엔 1~2개가 좋아요)</em>
              </span>
              <div className="ui-picks">
                {exps.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className="ui-pick"
                    aria-pressed={picked.includes(x.id)}
                    onClick={() => togglePick(e.id, x.id)}
                  >
                    <strong>
                      {x.starred && "★ "}
                      {x.title}
                      {overused.has(x.id) && picked.includes(x.id) && " ⚠"}
                    </strong>
                    {x.message && <em>{x.message}</em>}
                  </button>
                ))}
              </div>
              {picked.some((id) => overused.has(id)) && (
                <p className="ui-hint">
                  ⚠ 다른 문항에도 쓰는 경험이 있어요. 같은 얘기가 반복되면 읽는 사람이 금방
                  알아챕니다.
                </p>
              )}
            </div>

            <div className="ui-field">
              <span>
                톤 <em>(선택)</em>
              </span>
              <div className="ui-actions">
                {[
                  { v: "", l: "기본" },
                  { v: "result", l: "결과 중심" },
                  { v: "process", l: "과정·배움" },
                  { v: "plain", l: "담백하게" },
                ].map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    className="ui-chip"
                    aria-pressed={(tone[e.id] ?? "") === t.v}
                    onClick={() => setTone((p) => ({ ...p, [e.id]: t.v }))}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="ui-actions is-end">
              {e.charCount > 0 && (
                <button
                  className="ui-btn ui-btn-ghost"
                  onClick={() => {
                    setOpenId(isOpen ? null : e.id);
                    setDraftText(e.content);
                  }}
                >
                  {isOpen ? "접기" : "열어서 고치기"}
                </button>
              )}
              <button className="ui-btn" onClick={() => draft(e)} disabled={picked.length === 0}>
                {e.charCount > 0 ? "🔄 다시 뽑기" : "✍️ 초안 뽑기"}
              </button>
            </div>

            {/* 편집 */}
            {isOpen && (
              <>
                <textarea
                  className="ui-textarea is-tall"
                  rows={12}
                  value={draftText}
                  onChange={(ev) => setDraftText(ev.target.value)}
                />

                <div className="ui-actions">
                  <span className="ui-count">
                    {Array.from(draftText).length}자{e.maxChars ? ` / ${e.maxChars}` : ""}
                  </span>
                  <ShareButton kind="essay" targetId={e.id} />
                  <button
                    className="ui-btn"
                    style={{ marginLeft: "auto" }}
                    onClick={() => saveEdited(e.id)}
                  >
                    {saveState === "saving"
                      ? "저장 중…"
                      : saveState === "saved"
                      ? "저장됨!"
                      : "💾 저장"}
                  </button>
                </div>

                <div className="ui-tells">
                  <h3>
                    {tells.length === 0
                      ? "✅ AI 자국이 안 보여요"
                      : `🔎 아직 남은 곳 ${tells.length}군데`}
                  </h3>

                  {tells.length === 0 ? (
                    <p className="ui-hint">
                      뽑으면서 한 번 다듬었어요. 그래도{" "}
                      <strong>첫 문장과 마지막 문장은 직접 손보는 걸</strong> 권해요 — 제일 눈길이
                      머무는 자리예요.
                    </p>
                  ) : (
                    tells.map((t, k) => (
                      <div className={`ui-tell is-${t.severity}`} key={k}>
                        <p className="ui-tell-head">
                          <span className="ui-tell-tag">
                            {t.severity === "high" ? "고침 권장" : "살펴보기"}
                          </span>
                          {t.title}
                        </p>
                        <p className="ui-tell-detail">{t.detail}</p>
                        {t.sample && <p className="ui-tell-sample">“{t.sample}”</p>}
                      </div>
                    ))
                  )}
                </div>

                {e.questions && e.questions.length > 0 && (
                  <div className="ui-gaps">
                    <h3>이걸 알려주면 초안이 좋아져요</h3>
                    {e.questions.map((q, k) => (
                      <div className="ui-gap" key={k}>
                        <p className="ui-gap-q">{q.question}</p>
                        <p className="ui-gap-why">{q.about}</p>
                      </div>
                    ))}
                    <p className="ui-hint">
                      경험에 없는 내용은 지어내지 않았어요. 채워 넣고 다시 뽑으면 구체적인 글이
                      됩니다.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* 문항 추가 */}
      <section className="ui-sec">
        <div className="ui-sec-head">
          <h2>+ 문항 추가</h2>
          <p>공고에 있는 문항을 그대로 옮겨 적으세요</p>
        </div>

        <div className="ui-panel ui-form">
          <label className="ui-field">
            <span>문항</span>
            <textarea
              className="ui-textarea"
              rows={2}
              value={newPrompt}
              onChange={(ev) => {
                setNewPrompt(ev.target.value);
                if (ev.target.value.trim()) setNewKind(guessKind(ev.target.value));
              }}
              placeholder="예) 지원 동기와 입사 후 이루고 싶은 목표를 기술해 주십시오."
            />
          </label>

          <div className="ui-field">
            <span>
              문항 유형 <em>(자동 추측 — 틀리면 바꿔주세요)</em>
            </span>
            <div className="ui-actions">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className="ui-chip"
                  aria-pressed={newKind === k.id}
                  onClick={() => setNewKind(k.id)}
                  title={k.looksFor}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <label className="ui-field is-narrow">
            <span>
              글자수 제한 <em>(선택)</em>
            </span>
            <input
              className="ui-input"
              type="number"
              min={0}
              value={newMax}
              onChange={(ev) => setNewMax(ev.target.value)}
              placeholder="예: 800"
            />
          </label>

          {error && <p className="ui-note is-err">{error}</p>}

          <div className="ui-actions is-end">
            <button className="ui-btn" onClick={addQuestion} disabled={!newPrompt.trim()}>
              + 문항 추가
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
