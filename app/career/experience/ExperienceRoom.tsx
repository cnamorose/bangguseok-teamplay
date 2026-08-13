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
  const [view, setView] = useState<View>("cards");

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
      <div className="tp-career-col">
        <div className="tp-panel">
          <p className="tp-col-title">🧰 경험을 떠오르는 대로 적어보세요</p>
          <p className="tp-sub-desc" style={{ margin: 0 }}>
            문장이 엉켜도 괜찮아요. 항목별로 나누고 부족한 곳을 짚어드릴게요.
          </p>
          <textarea
            className="tp-textarea"
            rows={7}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={
              "예) 작년에 학회에서 웹사이트 만들었음. 4명이서 했고 내가 백엔드 맡음.\n로딩이 너무 느려서 사람들이 불평했는데 캐싱 넣어서 빨라짐"
            }
            style={{ width: "100%", boxSizing: "border-box" }}
          />

          {error && <p className="tp-error">{error}</p>}

          <div className="tp-choices">
            <button
              className="tp-btn"
              onClick={organize}
              disabled={organizing || raw.trim().length < 10}
            >
              {organizing ? "✨ 정리하는 중..." : "✨ 정리하기"}
            </button>
            <button
              className="tp-btn-outline"
              onClick={() => {
                setWriting(false);
                setRaw("");
                setDraft(null);
                setError("");
              }}
            >
              그만두기
            </button>
          </div>
        </div>

        {draft && (
          <div className="tp-panel">
            <p className="tp-col-title">이렇게 정리했어요 — 고쳐도 돼요</p>

            <label className="tp-field">
              <span className="tp-label">경험 이름</span>
              <input
                className="tp-input"
                value={draft.title ?? ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>

            {FIELDS.map((f) => (
              <label className="tp-field" key={f.key}>
                <span className="tp-label">{f.label}</span>
                {f.long ? (
                  <textarea
                    className="tp-textarea"
                    rows={2}
                    value={(draft[f.key] as string) ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                ) : (
                  <input
                    className="tp-input"
                    value={(draft[f.key] as string) ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                  />
                )}
              </label>
            ))}

            {draft.tags && draft.tags.length > 0 && (
              <div className="tp-sub tp-sub-tight">
                <p className="tp-sub-title">키워드</p>
                <div className="tp-choices">
                  {draft.tags.map((t, i) => (
                    <span key={i} className="tp-role-chip">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {draft.gaps && draft.gaps.length > 0 && (
              <div className="tp-gaps">
                <p className="tp-sub-title">⚠️ 이걸 채우면 자소서에 바로 쓸 수 있어요</p>
                {draft.gaps.map((g, i) => (
                  <div className="tp-gap" key={i}>
                    <p className="tp-gap-q">{g.question}</p>
                    <p className="tp-gap-why">{g.issue}</p>
                  </div>
                ))}
                <p className="tp-sub-desc" style={{ margin: 0 }}>
                  지금 답해도 되고, 저장한 뒤 나중에 채워도 돼요.
                </p>
              </div>
            )}

            <button className="tp-btn" onClick={saveDraft}>💾 저장하기</button>
          </div>
        )}
      </div>
    );
  }

  /* ── 편집 화면 ── */
  if (editing) {
    const warn = quickWarnings(editing);
    return (
      <div className="tp-career-col">
        <div className="tp-panel">
          <div className="tp-edit-head">
            <input
              className="tp-input"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <button
              className={`tp-star${editing.starred ? " is-on" : ""}`}
              onClick={() => setEditing({ ...editing, starred: !editing.starred })}
              aria-pressed={editing.starred}
              title="핵심 경험으로 표시"
            >
              ★
            </button>
          </div>

          {checking && <p className="tp-note">🔍 칸이 제대로 들어갔는지 보는 중...</p>}

          {!checking && editing.gaps && editing.gaps.length > 0 && (
            <div className="tp-gaps">
              <p className="tp-sub-title">이렇게 고치면 더 좋아요</p>
              {editing.gaps.map((g, i) => (
                <div className={`tp-gap is-${g.kind ?? "missing"}`} key={i}>
                  <p className="tp-gap-q">
                    <span className="tp-gap-tag">{GAP_LABEL[g.kind ?? "missing"]}</span>
                    {FIELD_LABEL[g.field] ?? g.field}
                  </p>
                  <p className="tp-gap-q">{g.question}</p>
                  <p className="tp-gap-why">{g.issue}</p>
                </div>
              ))}
            </div>
          )}

          {warn.length > 0 && (
            <p className="tp-sub-desc" style={{ margin: 0 }}>
              비어 있는 칸 — {warn.join(" · ")}
            </p>
          )}

          {FIELDS.map((f) => (
            <label className="tp-field" key={f.key}>
              <span className="tp-label">{f.label}</span>
              {f.long ? (
                <textarea
                  className="tp-textarea"
                  rows={2}
                  value={(editing[f.key] as string) ?? ""}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              ) : (
                <input
                  className="tp-input"
                  value={(editing[f.key] as string) ?? ""}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              )}
            </label>
          ))}

          <div className="tp-choices">
            <button
              className="tp-btn"
              onClick={async () => {
                const body: Record<string, unknown> = { starred: editing.starred, title: editing.title };
                for (const f of FIELDS) body[f.key] = (editing[f.key] as string) ?? "";
                await patch(editing.id, body);
                // 저장은 여기서 끝. 점검은 뒤따라 붙어서 gaps만 갱신한다
                check(editing.id);
              }}
            >
              💾 저장하고 점검
            </button>
            <button
              className="tp-btn-outline"
              onClick={() => check(editing.id)}
              disabled={checking}
            >
              🔍 다시 점검
            </button>
            <button className="tp-btn-outline" onClick={() => setEditing(null)}>돌아가기</button>
            <button className="tp-btn-outline" onClick={() => remove(editing.id)}>🗑️ 삭제</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 목록 ── */
  return (
    <div className="tp-career-col">
      <div className="tp-shelf-bar">
        <SegmentedToggle
          ariaLabel="보기 전환"
          value={view}
          onChange={setView}
          options={[
            { value: "cards", label: "🗂️ 카드" },
            { value: "table", label: "📊 표" },
          ]}
        />
        <button className="tp-btn-sm" style={{ marginLeft: "auto" }} onClick={() => setWriting(true)}>
          + 경험 추가
        </button>
      </div>

      {loading && <p className="tp-note">경험을 불러오는 중...</p>}
      {error && <p className="tp-note tp-note-error">{error}</p>}

      {!loading && items.length === 0 && (
        <div className="tp-shelf-empty">
          아직 정리한 경험이 없어요.
          <br />떠오르는 대로 적으면 항목별로 나눠드릴게요!
        </div>
      )}

      {!loading && items.length > 0 && view === "cards" && (
        <div className="tp-company-grid">
          {items.map((e) => {
            const { filled, total } = completeness(e);
            const warn = quickWarnings(e);
            return (
              <button key={e.id} className="tp-company-card" onClick={() => setEditing(e)}>
                <h3 className="tp-company-name">
                  {e.starred && <span className="tp-star is-on">★</span>} {e.title}
                </h3>
                <p className="tp-company-date">
                  {[e.period, e.role].filter(Boolean).join(" · ") || "아직 비어 있어요"}
                </p>
                {e.message && <p className="tp-exp-msg">“{e.message}”</p>}
                {e.tags.length > 0 && (
                  <div className="tp-company-roles">
                    {e.tags.map((t, i) => (
                      <span key={i} className="tp-role-chip">{t}</span>
                    ))}
                  </div>
                )}
                <div className="tp-exp-meter" aria-label={`완성도 ${filled}/${total}`}>
                  {Array.from({ length: total }, (_, i) => (
                    <span key={i} className={i < filled ? "is-on" : ""} />
                  ))}
                  <em>{filled}/{total}</em>
                </div>
                {warn.length > 0 && <p className="tp-exp-warn">⚠ {warn[0]}</p>}
              </button>
            );
          })}
        </div>
      )}

      {!loading && items.length > 0 && view === "table" && (
        <div className="tp-exp-table-wrap">
          <table className="tp-exp-table">
            <thead>
              <tr>
                <th>경험</th><th>역할</th><th>상황</th><th>한 일</th>
                <th>결과</th><th>키워드</th><th>완성도</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const { filled, total } = completeness(e);
                return (
                  <tr key={e.id} onClick={() => setEditing(e)}>
                    <td>
                      {e.starred && <span className="tp-star is-on">★</span>} <strong>{e.title}</strong>
                      {e.period && <><br /><span className="tp-exp-sub">{e.period}</span></>}
                    </td>
                    <td>{e.role}</td>
                    <td>{e.situation}</td>
                    <td>{e.action}</td>
                    <td className={e.impact ? "" : "is-empty"}>{e.impact || "비어 있음"}</td>
                    <td>{e.tags.join(", ")}</td>
                    <td className="tp-exp-num">{filled}/{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
