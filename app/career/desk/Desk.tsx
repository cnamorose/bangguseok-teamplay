"use client";

import Loading from "@/app/components/Loading";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ColorTab from "@/app/components/ColorTab";
import { ddayLabel, isUrgent, statusLabel } from "./status";

interface AppRow {
  id: string;
  role: string;
  deadline: string | null;
  status: string;
  pinned: boolean;
  /** 인덱스 탭 색 ("book-3") · null이면 id에서 뽑는다 */
  color: string | null;
  analyzedAt: string | null; // 직무 분석
  company: { id: string; name: string; analyzedAt: string | null };
  essays: { id: string; charCount: number }[];
}

interface CompanyOpt {
  id: string;
  name: string;
  analyzedAt: string | null;
}

export default function Desk() {
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 지원 건 추가
  const [adding, setAdding] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("");
  const [posting, setPosting] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/career/applications").then((r) => r.json()),
      fetch("/api/career/companies").then((r) => r.json()),
    ])
      .then(([a, c]) => {
        if (a.error) setError(a.error);
        else setApps(a.applications);
        if (!c.error) {
          setCompanies(c.companies);
          if (c.companies.length > 0) setCompanyId((prev) => prev || c.companies[0].id);
        }
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/career/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, role: role.trim(), jobPosting: posting.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "지원 건을 만들지 못했습니다.");
        return;
      }
      setAdding(false);
      setRole("");
      setPosting("");
      router.push(`/career/desk/${data.application.id}`);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const togglePin = async (e: React.MouseEvent, app: AppRow) => {
    e.stopPropagation(); // 카드 열기와 겹치지 않게
    await fetch(`/api/career/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !app.pinned }),
    });
    load();
  };

  /** 인덱스 탭 색 바꾸기 — 화면을 먼저 바꾸고 서버에 알린다 */
  const setColor = (id: string, color: string | null) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, color } : a)));
    fetch(`/api/career/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    }).catch(() => {});
  };

  if (loading) return <Loading label="책상을 정리하는 중…" />;

  if (creating) {
    return (
      <div className="ui-run">
        <p className="ui-run-msg">
          {posting.trim() ? "📄 채용공고를 읽는 중…" : "🔎 이 직무를 알아보는 중…"}
        </p>
        <div className="ui-progress">
          <span className="ui-progress-fill is-indet" />
        </div>
      </div>
    );
  }

  // 분석해 둔 회사가 없으면 거기부터
  if (companies.length === 0) {
    return (
      <>
        <header className="ui-head">
          <h1>책상</h1>
          <p>지원하는 회사와 직무를 여기 올려두고 챙겨요.</p>
        </header>

        <div className="ui-empty">
          <div style={{ fontSize: 34 }}>🏢</div>
          <h3>먼저 회사를 분석해주세요</h3>
          <p>회사를 알아야 그 회사 공고를 제대로 읽을 수 있어요.</p>
          <button className="ui-btn" onClick={() => router.push("/career/companies")}>
            🏢 기업 분석하러 가기
          </button>
        </div>
      </>
    );
  }

  const addPanel = (
    <div className="ui-panel ui-form">
      <h3>📄 지원 건 추가</h3>

      <label className="ui-field is-narrow">
        <span>회사</span>
        <select
          className="ui-input"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.analyzedAt ? "" : " (분석 전)"}
            </option>
          ))}
        </select>
      </label>

      <label className="ui-field">
        <span>
          채용공고 <em>(붙여넣기 · 있으면 훨씬 정확해요)</em>
        </span>
        <textarea
          className="ui-textarea is-tall"
          rows={7}
          value={posting}
          onChange={(e) => setPosting(e.target.value)}
          placeholder={
            "공고 페이지를 통째로 복사해서 붙여넣으세요.\n담당업무 · 자격요건 · 우대사항 · 마감일이 다 들어 있으면 좋아요."
          }
        />
        <p className="ui-hint">
          공고가 있으면 직무명과 <strong>마감일까지 알아서 잡아요.</strong> 자격요건도 추측하지
          않고 원문 그대로 씁니다.
        </p>
      </label>

      <label className="ui-field is-narrow">
        <span>
          직무명{" "}
          <em>{posting.trim() ? "(공고에서 찾으면 그걸 씁니다)" : "(공고가 없으면 필수)"}</em>
        </span>
        <input
          className="ui-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="예: 백엔드 개발"
        />
      </label>

      {error && <p className="ui-note is-err">{error}</p>}

      <div className="ui-actions is-end">
        {apps.length > 0 && (
          <button className="ui-btn ui-btn-ghost" onClick={() => setAdding(false)}>
            그만두기
          </button>
        )}
        <button
          className="ui-btn"
          onClick={create}
          disabled={!companyId || (!role.trim() && !posting.trim())}
        >
          📄 공고 분석하고 추가
        </button>
      </div>
    </div>
  );

  if (apps.length === 0 || adding) {
    return (
      <>
        <header className="ui-head">
          <h1>책상</h1>
          <p>
            {apps.length === 0
              ? "아직 지원 건이 없어요. 공고를 붙여넣으면 마감일까지 자동으로 잡힙니다."
              : "지원하는 회사와 직무를 여기 올려두고 챙겨요."}
          </p>
        </header>
        {addPanel}
      </>
    );
  }

  return (
    <>
      <header className="ui-head is-row">
        <div>
          <h1>책상</h1>
          <p>마감이 가까운 순으로 놓여 있어요. 급한 건 📌로 고정할 수 있습니다.</p>
        </div>
        <button className="ui-btn" onClick={() => setAdding(true)}>
          + 지원 건 추가
        </button>
      </header>

      {error && <p className="ui-note is-err">{error}</p>}

      <div className="ui-grid">
        {apps.map((a) => {
          const dday = ddayLabel(a.deadline);
          const urgent = isUrgent(a.deadline, a.status);
          const written = a.essays.filter((e) => e.charCount > 0).length;

          return (
            <div
              key={a.id}
              className={`ui-panel is-click${urgent ? " is-urgent" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/career/desk/${a.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/career/desk/${a.id}`)}
            >
              <ColorTab id={a.id} color={a.color} onPick={(c) => setColor(a.id, c)} />

              <h3>
                {a.company.name} · {a.role}
              </h3>

              <button
                type="button"
                className={`ui-pin${a.pinned ? " is-on" : ""}`}
                onClick={(e) => togglePin(e, a)}
                aria-pressed={a.pinned}
                aria-label={a.pinned ? "고정 풀기" : "고정하기"}
                title={a.pinned ? "고정 풀기" : "고정하기"}
              >
                📌
              </button>

              <div className="ui-actions" style={{ margin: "2px 0 6px" }}>
                {dday && (
                  <span className={`ui-badge ${urgent ? "is-fail is-urgent" : "is-mute"}`}>
                    {dday}
                  </span>
                )}
                <span className="ui-badge is-mute">{statusLabel(a.status)}</span>
              </div>

              <ul className="ui-check">
                <li className={a.company.analyzedAt ? "is-done" : ""}>
                  {a.company.analyzedAt ? "✓" : "○"} 기업 분석
                </li>
                <li className={a.analyzedAt ? "is-done" : ""}>
                  {a.analyzedAt ? "✓" : "○"} 직무 분석
                </li>
                <li className={written > 0 ? "is-done" : ""}>
                  {written > 0 ? "✓" : "○"} 자소서{" "}
                  {a.essays.length > 0 ? `${written}/${a.essays.length}문항` : "—"}
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
