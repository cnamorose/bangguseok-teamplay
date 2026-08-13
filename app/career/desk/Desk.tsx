"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ddayLabel, isUrgent, statusLabel } from "./status";

interface AppRow {
  id: string;
  role: string;
  deadline: string | null;
  status: string;
  pinned: boolean;
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

  if (loading) return <p className="tp-note">책상을 정리하는 중...</p>;

  if (creating) {
    return (
      <div className="tp-progress-wrap">
        <p className="tp-progress-msg">
          {posting.trim() ? "📄 채용공고를 읽는 중..." : "🔎 이 직무를 알아보는 중..."}
        </p>
        <div className="tp-progress-bar">
          <div className="tp-progress-fill tp-progress-indet" />
        </div>
      </div>
    );
  }

  // 분석해 둔 회사가 없으면 거기부터
  if (companies.length === 0) {
    return (
      <div className="tp-shelf-empty">
        <div style={{ fontSize: 34, marginBottom: 8 }}>🏢</div>
        <strong>먼저 회사를 분석해주세요</strong>
        <br />
        회사를 알아야 그 회사 공고를 제대로 읽을 수 있어요.
        <br />
        <button
          className="tp-btn"
          style={{ marginTop: 16 }}
          onClick={() => router.push("/career/companies")}
        >
          🏢 기업 분석하러 가기
        </button>
      </div>
    );
  }

  const addPanel = (
    <div className="tp-panel">
      <p className="tp-col-title">📄 지원 건 추가</p>

      <label className="tp-field">
        <span className="tp-label">회사</span>
        <select className="tp-input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.analyzedAt ? "" : " (분석 전)"}
            </option>
          ))}
        </select>
      </label>

      <label className="tp-field">
        <span className="tp-label">
          채용공고 <span className="tp-optional">(붙여넣기 · 있으면 훨씬 정확해요)</span>
        </span>
        <textarea
          className="tp-textarea"
          rows={7}
          value={posting}
          onChange={(e) => setPosting(e.target.value)}
          placeholder={"공고 페이지를 통째로 복사해서 붙여넣으세요.\n담당업무 · 자격요건 · 우대사항 · 마감일이 다 들어 있으면 좋아요."}
          style={{ width: "100%", boxSizing: "border-box" }}
        />
        <span className="tp-sub-desc" style={{ margin: 0 }}>
          공고가 있으면 직무명과 <strong>마감일까지 알아서 잡아요.</strong> 자격요건도 추측하지 않고 원문 그대로 씁니다.
        </span>
      </label>

      <label className="tp-field">
        <span className="tp-label">
          직무명 <span className="tp-optional">{posting.trim() ? "(공고에서 찾으면 그걸 씁니다)" : "(공고가 없으면 필수)"}</span>
        </span>
        <input
          className="tp-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="예: 백엔드 개발"
        />
      </label>

      {error && <p className="tp-error">{error}</p>}

      <div className="tp-choices">
        <button
          className="tp-btn"
          onClick={create}
          disabled={!companyId || (!role.trim() && !posting.trim())}
        >
          📄 공고 분석하고 추가
        </button>
        {apps.length > 0 && (
          <button className="tp-btn-outline" onClick={() => setAdding(false)}>그만두기</button>
        )}
      </div>
    </div>
  );

  if (apps.length === 0 || adding) {
    return (
      <div className="tp-career-col">
        {apps.length === 0 && (
          <p className="tp-sub-desc" style={{ margin: 0 }}>
            아직 지원 건이 없어요. 공고를 붙여넣으면 마감일까지 자동으로 잡힙니다.
          </p>
        )}
        {addPanel}
      </div>
    );
  }

  return (
    <div className="tp-career-col">
      <div className="tp-shelf-bar">
        <p className="tp-sub-desc" style={{ margin: 0 }}>
          마감이 가까운 순으로 놓여 있어요. 급한 건 📌로 고정할 수 있습니다.
        </p>
        <button className="tp-btn-sm" style={{ marginLeft: "auto" }} onClick={() => setAdding(true)}>
          + 지원 건 추가
        </button>
      </div>

      {error && <p className="tp-note tp-note-error">{error}</p>}

      <div className="tp-desk-grid">
        {apps.map((a) => {
          const dday = ddayLabel(a.deadline);
          const urgent = isUrgent(a.deadline, a.status);
          const written = a.essays.filter((e) => e.charCount > 0).length;

          return (
            <button
              key={a.id}
              type="button"
              className={`tp-desk-card${urgent ? " is-urgent" : ""}`}
              onClick={() => router.push(`/career/desk/${a.id}`)}
            >
              <div className="tp-desk-top">
                <h3 className="tp-desk-name">
                  {a.company.name} <span>· {a.role}</span>
                </h3>
                <span
                  className={`tp-pin${a.pinned ? " is-on" : ""}`}
                  onClick={(e) => togglePin(e, a)}
                  role="button"
                  tabIndex={0}
                  aria-label="고정"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") togglePin(e as unknown as React.MouseEvent, a);
                  }}
                >
                  📌
                </span>
              </div>

              <div className="tp-desk-meta">
                {dday && <span className={`tp-dday${urgent ? " is-urgent" : ""}`}>{dday}</span>}
                <span className={`tp-status is-${a.status}`}>{statusLabel(a.status)}</span>
              </div>

              <ul className="tp-desk-steps">
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
