"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, ddayLabel, isUrgent, statusLabel } from "../status";
import { KINDS } from "@/lib/agents/essay/kinds";
import { CompanyAnalysis, RoleAnalysis } from "@/lib/agents/company/types";

interface EssayRow {
  id: string;
  prompt: string;
  kind: string;
  maxChars: number | null;
  content: string;
  charCount: number;
}

interface AppDetail {
  id: string;
  role: string;
  deadline: string | null;
  status: string;
  pinned: boolean;
  roleAnalysis: RoleAnalysis | null;
  company: {
    id: string;
    name: string;
    analysis: CompanyAnalysis | null;
    analyzedAt: string | null;
    notes: string | null;
  };
  essays: EssayRow[];
}

export default function ApplicationView({ id }: { id: string }) {
  const router = useRouter();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openEssay, setOpenEssay] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/career/applications/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setApp(data.application);
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/career/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  if (loading) return <p className="tp-note">불러오는 중...</p>;
  if (error) return <p className="tp-note tp-note-error">{error}</p>;
  if (!app) return null;

  const a = app.company.analysis;
  const dday = ddayLabel(app.deadline);
  const urgent = isUrgent(app.deadline, app.status);
  const written = app.essays.filter((e) => e.charCount > 0).length;

  return (
    <div className="tp-career-col">
      {/* 머리 */}
      <div className="tp-hero">
        <div className="tp-hero-top">
          <h1 className="tp-hero-name">
            {app.company.name} <span style={{ fontWeight: 700 }}>· {app.role}</span>
          </h1>
          {dday && <span className={`tp-dday${urgent ? " is-urgent" : ""}`}>{dday}</span>}
        </div>

        <div className="tp-desk-controls">
          <label className="tp-inline-field">
            <span>마감</span>
            <input
              className="tp-input"
              type="date"
              value={app.deadline ? app.deadline.slice(0, 10) : ""}
              onChange={(e) => patch({ deadline: e.target.value })}
            />
          </label>

          <div className="tp-choices">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="tp-chip"
                aria-pressed={app.status === s.id}
                onClick={() => patch({ status: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            className={`tp-btn-sm${app.pinned ? "" : " tp-btn-outline"}`}
            onClick={() => patch({ pinned: !app.pinned })}
          >
            📌 {app.pinned ? "고정됨" : "고정하기"}
          </button>
        </div>

        <div className="tp-hero-actions">
          <button className="tp-btn-outline" onClick={() => router.push("/career/desk")}>
            🗂️ 책상으로
          </button>
        </div>
      </div>

      {/* 기업 분석 */}
      <div className="tp-blk">
        <h2 className="tp-blk-head">🏢 기업 분석</h2>
        {a ? (
          <>
            <p className="tp-blk-body">
              이 회사는 지금 <strong>{a.headline.cause}</strong> 때문에{" "}
              <strong>{a.headline.direction}</strong>을 강화하고 있다.
            </p>
            {a.headline.keywords?.length > 0 && (
              <div className="tp-choices">
                {a.headline.keywords.map((k, i) => (
                  <span key={i} className="tp-role-chip">{k}</span>
                ))}
              </div>
            )}
            <p className="tp-exp-sub">
              {app.company.analyzedAt &&
                `${new Date(app.company.analyzedAt).toLocaleDateString("ko-KR")} 기준`}
            </p>
          </>
        ) : (
          <p className="tp-blk-body">아직 분석 전이에요.</p>
        )}
        <div className="tp-choices">
          <button
            className="tp-btn-sm"
            onClick={() => router.push(`/career/companies/${app.company.id}`)}
          >
            자세히 보기
          </button>
        </div>
      </div>

      {/* 직무 분석 */}
      <div className="tp-blk">
        <h2 className="tp-blk-head">🧭 {app.role} 직무</h2>
        {app.roleAnalysis ? (
          <>
            <p className="tp-blk-body">{app.roleAnalysis.linkToStrategy}</p>
            {app.roleAnalysis.requirements?.length > 0 && (
              <ul className="tp-check">
                {app.roleAnalysis.requirements.map((r, i) => (
                  <li key={i}>☑ {r}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="tp-blk-body">
            아직 직무 분석이 없어요. 기업 분석에서 직무를 넣고 돌리면 여기 붙어요.
          </p>
        )}
      </div>

      {/* 자소서 */}
      <div className="tp-blk is-star">
        <h2 className="tp-blk-head">
          📝 자소서 {app.essays.length > 0 && `— ${written}/${app.essays.length}문항`}
        </h2>

        {app.essays.length === 0 ? (
          <p className="tp-blk-body">아직 문항이 없어요.</p>
        ) : (
          app.essays.map((e) => (
            <div key={e.id} className="tp-essay-item">
              <div className="tp-essay-row">
                <div>
                  <strong>{e.prompt}</strong>
                  <p className="tp-exp-sub">
                    {KINDS.find((k) => k.id === e.kind)?.label} · {e.charCount}자
                    {e.maxChars ? ` / ${e.maxChars}` : ""}
                    {e.maxChars && e.charCount > e.maxChars && (
                      <span className="tp-over"> · 제한 초과</span>
                    )}
                  </p>
                </div>
                <button
                  className="tp-btn-sm"
                  onClick={() => setOpenEssay(openEssay === e.id ? null : e.id)}
                >
                  {openEssay === e.id ? "접기" : "펼치기"}
                </button>
              </div>
              {openEssay === e.id && <div className="tp-essay-body">{e.content}</div>}
            </div>
          ))
        )}

        <div className="tp-choices">
          <button className="tp-btn" onClick={() => router.push("/career/resume")}>
            ✍️ 자소서 쓰러 가기
          </button>
        </div>
      </div>

      {/* 내 메모 (회사 단위라 읽기만) */}
      {app.company.notes && (
        <div className="tp-blk is-note">
          <h2 className="tp-blk-head">📝 {app.company.name} 메모</h2>
          <p className="tp-blk-body" style={{ whiteSpace: "pre-wrap" }}>{app.company.notes}</p>
        </div>
      )}
    </div>
  );
}
