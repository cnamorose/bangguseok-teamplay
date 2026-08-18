"use client";

import Loading from "@/app/components/Loading";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ShareButton from "@/app/components/ShareButton";
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

  if (loading) return <Loading label="불러오는 중…" />;
  if (error) return <p className="ui-note is-err">{error}</p>;
  if (!app) return null;

  const a = app.company.analysis;
  const dday = ddayLabel(app.deadline);
  const urgent = isUrgent(app.deadline, app.status);
  const written = app.essays.filter((e) => e.charCount > 0).length;

  return (
    <>
      {/* 머리 */}
      <div className="ui-hero">
        <div className="ui-hero-top">
          <h1>
            {app.company.name} · {app.role}
          </h1>
          {dday && (
            <span className={`ui-badge ${urgent ? "is-fail is-urgent" : "is-mute"}`}>{dday}</span>
          )}
          <button
            className="ui-btn ui-btn-ghost"
            style={{ marginLeft: "auto" }}
            onClick={() => router.push("/career/desk")}
          >
            🗂️ 책상으로
          </button>
        </div>

        <div className="ui-actions">
          <label className="ui-chipfield">
            <span>마감</span>
            <input
              type="date"
              value={app.deadline ? app.deadline.slice(0, 10) : ""}
              onChange={(e) => patch({ deadline: e.target.value })}
            />
          </label>

          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ui-chip"
              aria-pressed={app.status === s.id}
              onClick={() => patch({ status: s.id })}
            >
              {s.label}
            </button>
          ))}

          <button
            type="button"
            className="ui-chip"
            aria-pressed={app.pinned}
            onClick={() => patch({ pinned: !app.pinned })}
          >
            📌 {app.pinned ? "고정됨" : "고정하기"}
          </button>
        </div>
      </div>

      {/* 기업 분석 */}
      <section className="ui-sec">
        <div className="ui-sec-head">
          <h2>🏢 기업 분석</h2>
          {app.company.analyzedAt && (
            <p>{new Date(app.company.analyzedAt).toLocaleDateString("ko-KR")} 기준</p>
          )}
        </div>

        <div className="ui-panel ui-form">
          {a ? (
            <>
              <p className="ui-judge-body">
                이 회사는 지금 <strong>{a.headline.cause}</strong> 때문에{" "}
                <strong>{a.headline.direction}</strong>을 강화하고 있다.
              </p>
              {a.headline.keywords?.length > 0 && (
                <div className="ui-actions">
                  {a.headline.keywords.map((k, i) => (
                    <span key={i} className="ui-chip">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="ui-judge-body">아직 분석 전이에요.</p>
          )}

          <div className="ui-actions is-end">
            <button
              className="ui-btn ui-btn-ghost"
              onClick={() => router.push(`/career/companies/${app.company.id}`)}
            >
              자세히 보기
            </button>
          </div>
        </div>
      </section>

      {/* 직무 분석 */}
      <section className="ui-sec">
        <div className="ui-sec-head">
          <h2>🧭 {app.role} 직무</h2>
        </div>

        <div className="ui-panel ui-form">
          {app.roleAnalysis ? (
            <>
              <p className="ui-judge-body">{app.roleAnalysis.linkToStrategy}</p>
              {app.roleAnalysis.requirements?.length > 0 && (
                <ul className="ui-check">
                  {app.roleAnalysis.requirements.map((r, i) => (
                    <li key={i}>☑ {r}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="ui-judge-body">
              아직 직무 분석이 없어요. 지원 건을 만들 때 공고를 넣으면 여기 붙어요.
            </p>
          )}
        </div>
      </section>

      {/* 자소서 */}
      <section className="ui-sec">
        <div className="ui-sec-head">
          <h2>📝 자소서</h2>
          {app.essays.length > 0 && (
            <p>
              {written}/{app.essays.length}문항
            </p>
          )}
          <button className="ui-more" onClick={() => router.push("/career/resume")}>
            ✍️ 자소서 쓰러 가기
          </button>
        </div>

        {app.essays.length === 0 ? (
          <div className="ui-empty">
            <h3>아직 문항이 없어요</h3>
            <p>자소서 작성에서 문항을 넣고 초안을 뽑으면 여기 모여요.</p>
          </div>
        ) : (
          <div className="ui-form">
            {app.essays.map((e) => (
              <div className="ui-panel ui-form" key={e.id} style={{ gap: 12 }}>
                <div className="ui-actions">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3>{e.prompt}</h3>
                    <p className="ui-hint">
                      {KINDS.find((k) => k.id === e.kind)?.label} · {e.charCount}자
                      {e.maxChars ? ` / ${e.maxChars}` : ""}
                      {e.maxChars && e.charCount > e.maxChars && (
                        <strong style={{ color: "var(--danger)" }}> · 제한 초과</strong>
                      )}
                    </p>
                  </div>
                  {/* 다 쓴 문항만 내놓을 수 있다 — 빈 글을 공유해봐야 볼 게 없다 */}
                  {e.charCount > 0 && <ShareButton kind="essay" targetId={e.id} />}

                  <button
                    className="ui-btn ui-btn-ghost"
                    onClick={() => setOpenEssay(openEssay === e.id ? null : e.id)}
                  >
                    {openEssay === e.id ? "접기" : "펼치기"}
                  </button>
                </div>
                {openEssay === e.id && <p className="ui-doc-body">{e.content}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 내 메모 (회사 단위라 읽기만) */}
      {app.company.notes && (
        <section className="ui-sec">
          <div className="ui-sec-head">
            <h2>📝 {app.company.name} 메모</h2>
          </div>
          <div className="ui-panel">
            <p className="ui-judge-body">{app.company.notes}</p>
          </div>
        </section>
      )}
    </>
  );
}
