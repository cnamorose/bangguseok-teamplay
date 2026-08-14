"use client";

import { useEffect, useState } from "react";
import SegmentedToggle from "@/app/components/SegmentedToggle";
import {
  Experience,
  FIELDS,
  FieldKey,
  Gap,
  completeness,
  quickWarnings,
} from "./fields";

type View = "cards" | "table";

// 지적의 종류 — 색만으로 구분하지 않고 라벨을 같이 단다
const GAP_LABEL: Record<string, string> = {
  missing: "비었어요",
  misplaced: "칸이 바뀐 듯",
  vague: "뭉뚱그렸어요",
  subject: "주어가 '우리'",
};

const FIELD_LABEL: Record<string, string> = {
  title: "경험 이름",
  period: "기간",
  role: "역할",
  situation: "상황 · 문제",
  action: "내가 한 일",
  impact: "결과",
  learning: "배운 점",
  message: "한 줄 메시지",
  tags: "키워드",
};

export default function ExperienceRoom() {
  const [items, setItems] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 표가 기본 — 경험이 쌓이면 한눈에 훑고 빈 칸을 찾는 게 주된 일이다
  const [view, setView] = useState<View>("table");

  // 새로 적기
  const [writing, setWriting] = useState(false);
  const [raw, setRaw] = useState("");
  const [organizing, setOrganizing] = useState(false);
  const [draft, setDraft] = useState<(Partial<Experience> & { gaps?: Gap[] }) | null>(null);

  // 편집 중인 경험
  const [editing, setEditing] = useState<Experience | null>(null);
  const [checking, setChecking] = useState(false);

  const load = () => {
    fetch("/api/career/experiences")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setItems(data.experiences);
      })
      .catch(() => setError("경험을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /* ── 막 적은 글 정리하기 ── */
  const organize = async () => {
    setError("");
    setOrganizing(true);
    try {
      const res = await fetch("/api/career/experiences/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "정리에 실패했습니다.");
        return;
      }
      setDraft(data.organized);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setOrganizing(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const res = await fetch("/api/career/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, raw }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "저장에 실패했습니다.");
      return;
    }
    setItems((prev) => [data.experience, ...prev]);
    setWriting(false);
    setRaw("");
    setDraft(null);
  };

  /* ── 편집 ── */
  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/career/experiences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) load();
  };

  /** 칸이 제대로 들어갔는지 점검 (저장과 분리 — 저장은 기다리지 않게) */
  const check = async (id: string) => {
    setChecking(true);
    try {
      const res = await fetch(`/api/career/experiences/${id}/check`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEditing((prev) => (prev && prev.id === id ? { ...prev, gaps: data.gaps } : prev));
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, gaps: data.gaps } : x)));
      }
    } catch {
      /* 점검 실패는 조용히 넘어간다 — 저장은 이미 끝났다 */
    } finally {
      setChecking(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/career/experiences/${id}`, { method: "DELETE" });
    setEditing(null);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  /* ── 새로 적기 화면 ── */
  if (writing) {
    return (
      <>
        <header className="ui-head">
          <h1>경험 추가</h1>
          <p>문장이 엉켜도 괜찮아요. 항목별로 나누고 부족한 곳을 짚어드릴게요.</p>
        </header>

        <div className="ui-panel ui-form">
          <label className="ui-field">
            <span>🧰 경험을 떠오르는 대로 적어보세요</span>
            <textarea
              className="ui-textarea is-tall"
              rows={7}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={
                "예) 작년에 학회에서 웹사이트 만들었음. 4명이서 했고 내가 백엔드 맡음.\n로딩이 너무 느려서 사람들이 불평했는데 캐싱 넣어서 빨라짐"
              }
            />
          </label>

          {error && <p className="ui-note is-err">{error}</p>}

          <div className="ui-actions is-end">
            <button
              className="ui-btn ui-btn-ghost"
              onClick={() => {
                setWriting(false);
                setRaw("");
                setDraft(null);
                setError("");
              }}
            >
              그만두기
            </button>
            <button
              className="ui-btn"
              onClick={organize}
              disabled={organizing || raw.trim().length < 10}
            >
              {organizing ? "✨ 정리하는 중…" : "✨ 정리하기"}
            </button>
          </div>
        </div>

        {draft && (
          <section className="ui-sec">
            <div className="ui-sec-head">
              <h2>이렇게 정리했어요</h2>
              <p>고쳐도 돼요</p>
            </div>

            <div className="ui-panel ui-form">
              <label className="ui-field">
                <span>경험 이름</span>
                <input
                  className="ui-input"
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>

              {FIELDS.map((f) => (
                <label className="ui-field" key={f.key}>
                  <span>{f.label}</span>
                  {f.long ? (
                    <textarea
                      className="ui-textarea"
                      rows={2}
                      value={(draft[f.key] as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                    />
                  ) : (
                    <input
                      className="ui-input"
                      value={(draft[f.key] as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                    />
                  )}
                </label>
              ))}

              {draft.tags && draft.tags.length > 0 && (
                <div className="ui-field">
                  <span>키워드</span>
                  <div className="ui-actions">
                    {draft.tags.map((t, i) => (
                      <span key={i} className="ui-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {draft.gaps && draft.gaps.length > 0 && (
                <div className="ui-gaps">
                  <h3>⚠️ 이걸 채우면 자소서에 바로 쓸 수 있어요</h3>
                  {draft.gaps.map((g, i) => (
                    <div className="ui-gap" key={i}>
                      <p className="ui-gap-q">{g.question}</p>
                      <p className="ui-gap-why">{g.issue}</p>
                    </div>
                  ))}
                  <p className="ui-hint">지금 답해도 되고, 저장한 뒤 나중에 채워도 돼요.</p>
                </div>
              )}

              <div className="ui-actions is-end">
                <button className="ui-btn" onClick={saveDraft}>
                  💾 저장하기
                </button>
              </div>
            </div>
          </section>
        )}
      </>
    );
  }

  /* ── 편집 화면 ── */
  if (editing) {
    const warn = quickWarnings(editing);
    return (
      <>
        <header className="ui-head is-row">
          <div>
            <h1>경험 고치기</h1>
            <p>칸에 맞게 들어갔는지 점검해드려요.</p>
          </div>
          <button className="ui-btn ui-btn-ghost" onClick={() => setEditing(null)}>
            ← 돌아가기
          </button>
        </header>

        <div className="ui-panel ui-form">
          <label className="ui-field">
            <span>
              경험 이름
              <button
                className={`ui-star${editing.starred ? " is-on" : ""}`}
                onClick={() => setEditing({ ...editing, starred: !editing.starred })}
                aria-pressed={editing.starred}
                title="핵심 경험으로 표시"
              >
                ★
              </button>
            </span>
            <input
              className="ui-input"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
          </label>

          {checking && <p className="ui-note">🔍 칸이 제대로 들어갔는지 보는 중…</p>}

          {!checking && editing.gaps && editing.gaps.length > 0 && (
            <div className="ui-gaps">
              <h3>이렇게 고치면 더 좋아요</h3>
              {editing.gaps.map((g, i) => (
                <div className="ui-gap" key={i}>
                  <p className="ui-gap-q">
                    <span className="ui-gap-tag">{GAP_LABEL[g.kind ?? "missing"]}</span>
                    {FIELD_LABEL[g.field] ?? g.field}
                  </p>
                  <p className="ui-gap-q">{g.question}</p>
                  <p className="ui-gap-why">{g.issue}</p>
                </div>
              ))}
            </div>
          )}

          {warn.length > 0 && <p className="ui-hint">비어 있는 칸 — {warn.join(" · ")}</p>}

          {FIELDS.map((f) => (
            <label className="ui-field" key={f.key}>
              <span>{f.label}</span>
              {f.long ? (
                <textarea
                  className="ui-textarea"
                  rows={2}
                  value={(editing[f.key] as string) ?? ""}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  className="ui-input"
                  value={(editing[f.key] as string) ?? ""}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              )}
            </label>
          ))}

          <div className="ui-actions">
            <button className="ui-btn ui-btn-ghost" onClick={() => remove(editing.id)}>
              🗑️ 삭제
            </button>
            <button
              className="ui-btn ui-btn-ghost"
              style={{ marginLeft: "auto" }}
              onClick={() => check(editing.id)}
              disabled={checking}
            >
              🔍 다시 점검
            </button>
            <button
              className="ui-btn"
              onClick={async () => {
                const body: Record<string, unknown> = {
                  starred: editing.starred,
                  title: editing.title,
                };
                for (const f of FIELDS) body[f.key] = (editing[f.key] as string) ?? "";
                await patch(editing.id, body);
                // 저장은 여기서 끝. 점검은 뒤따라 붙어서 gaps만 갱신한다
                check(editing.id);
              }}
            >
              💾 저장하고 점검
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ── 목록 ── */
  return (
    <>
      <header className="ui-head is-row">
        <div>
          <h1>내 경험</h1>
          <p>자소서와 면접이 여기서 재료를 꺼내 써요.</p>
        </div>
        <button className="ui-btn" onClick={() => setWriting(true)}>
          + 경험 추가
        </button>
      </header>

      <div className="ui-bar">
        <SegmentedToggle
          ariaLabel="보기 전환"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "📊 표" },
            { value: "cards", label: "🗂️ 카드" },
          ]}
        />
      </div>

      {loading && <p className="ui-note">경험을 불러오는 중…</p>}
      {error && <p className="ui-note is-err">{error}</p>}

      {!loading && items.length === 0 && (
        <div className="ui-empty">
          <h3>아직 정리한 경험이 없어요</h3>
          <p>떠오르는 대로 적으면 항목별로 나눠드릴게요.</p>
          <button className="ui-btn" onClick={() => setWriting(true)}>
            + 경험 추가
          </button>
        </div>
      )}

      {!loading && items.length > 0 && view === "cards" && (
        <div className="ui-grid">
          {items.map((e) => {
            const { filled, total } = completeness(e);
            const warn = quickWarnings(e);
            return (
              <button
                key={e.id}
                type="button"
                className="ui-panel is-click"
                onClick={() => setEditing(e)}
              >
                <h3>
                  {e.starred && <span className="ui-star is-on">★</span>} {e.title}
                </h3>
                <p className="ui-hint">
                  {[e.period, e.role].filter(Boolean).join(" · ") || "아직 비어 있어요"}
                </p>
                {e.message && <p className="ui-card-line">“{e.message}”</p>}

                {e.tags.length > 0 && (
                  <div className="ui-actions" style={{ margin: "2px 0" }}>
                    {e.tags.map((t, i) => (
                      <span key={i} className="ui-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="ui-meter" aria-label={`완성도 ${filled}/${total}`}>
                  {Array.from({ length: total }, (_, i) => (
                    <span key={i} className={i < filled ? "is-on" : ""} />
                  ))}
                  <em>
                    {filled}/{total}
                  </em>
                </div>

                {warn.length > 0 && <p className="ui-hint">⚠ {warn[0]}</p>}
              </button>
            );
          })}
        </div>
      )}

      {!loading && items.length > 0 && view === "table" && (
        <div className="ui-tablewrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>경험</th>
                <th>역할</th>
                <th>상황</th>
                <th>한 일</th>
                <th>결과</th>
                <th>키워드</th>
                <th>완성도</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const { filled, total } = completeness(e);
                return (
                  <tr key={e.id} onClick={() => setEditing(e)}>
                    <td>
                      {e.starred && <span className="ui-star is-on">★</span>}{" "}
                      <strong>{e.title}</strong>
                      {e.period && (
                        <>
                          <br />
                          <span className="ui-hint">{e.period}</span>
                        </>
                      )}
                    </td>
                    <td>{e.role}</td>
                    <td>{e.situation}</td>
                    <td>{e.action}</td>
                    <td className={e.impact ? "" : "is-empty"}>{e.impact || "비어 있음"}</td>
                    <td>{e.tags.join(", ")}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {filled}/{total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
