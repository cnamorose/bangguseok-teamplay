"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ShiftFlow from "../ShiftFlow";
import LanguageBars from "../LanguageBars";
import { CompanyAnalysis, RoleAnalysis } from "@/lib/agents/company/types";

interface AppRow {
  id: string;
  role: string;
  roleAnalysis: RoleAnalysis | null;
  analyzedAt: string | null;
}

interface CompanyRow {
  id: string;
  name: string;
  analysis: CompanyAnalysis | null;
  analyzedAt: string | null;
  notes: string | null;
  applications: AppRow[];
}

export default function CompanyView({ id }: { id: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [notes, setNotes] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [openRole, setOpenRole] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/career/company/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setCompany(data.company);
          setNotes(data.company.notes ?? "");
          setOpenRole(data.company.applications[0]?.id ?? null);
        }
      })
      .catch(() => setError("자료를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  const saveNotes = async () => {
    setNoteState("saving");
    try {
      await fetch(`/api/career/company/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setNoteState("saved");
      setTimeout(() => setNoteState("idle"), 1500);
    } catch {
      setNoteState("idle");
    }
  };

  if (loading) return <p className="tp-note">분석을 펼치는 중...</p>;
  if (error) return <p className="tp-note tp-note-error">{error}</p>;
  if (!company) return null;

  const a = company.analysis;
  const current = company.applications.find((x) => x.id === openRole) ?? null;

  return (
    <div className="tp-company-view">
      {/* ── 히어로: 이 회사는 지금 ○○ 때문에 ○○을 강화하고 있다 ── */}
      <div className="tp-hero">
        <div className="tp-hero-top">
          <h1 className="tp-hero-name">{company.name}</h1>
          <span className="tp-hero-date">
            {company.analyzedAt
              ? `${new Date(company.analyzedAt).toLocaleDateString("ko-KR")} 기준`
              : "분석 전"}
          </span>
        </div>

        {a && (
          <>
            <p className="tp-hero-line">
              이 회사는 지금 <strong>{a.headline.cause}</strong> 때문에{" "}
              <strong>{a.headline.direction}</strong>을 강화하고 있다.
            </p>
            <div className="tp-hero-keys">
              {a.headline.keywords.map((k, i) => (
                <span key={i} className="tp-key-chip">{k}</span>
              ))}
            </div>
          </>
        )}

        <div className="tp-hero-actions">
          <button className="tp-btn-outline" onClick={() => router.push("/career/companies")}>
            🏢 회사 목록
          </button>
        </div>
      </div>

      {!a && (
        <p className="tp-note">아직 분석 결과가 없어요. 목록에서 다시 분석해보세요.</p>
      )}

      {a && (
        <>
          {/* ① 정체 */}
          <section className="tp-blk">
            <h2 className="tp-blk-head"><span>①</span> 정체 — 무엇으로 돈을 버나</h2>
            <p className="tp-blk-body">{a.identity.summary}</p>
            <p className="tp-blk-body"><strong>고객·시장</strong> · {a.identity.customers}</p>
            {a.identity.connect && <p className="tp-connect">💡 {a.identity.connect}</p>}
          </section>

          {/* ② 흐름 */}
          <section className="tp-blk is-star">
            <h2 className="tp-blk-head"><span>②</span> 흐름 — 어디서 어디로 가고 있나</h2>
            <ShiftFlow
              years={a.shift.years ?? []}
              declared={a.shift.declared ?? []}
              conclusion={a.shift.conclusion}
            />
            {a.shift.issues?.length > 0 && (
              <ul className="tp-issues">
                {a.shift.issues.map((it, i) => (
                  <li key={i}>
                    <span className="tp-issue-date">{it.date}</span>
                    {it.source ? (
                      <a href={it.source} target="_blank" rel="noopener noreferrer" className="tp-entry-link">
                        {it.title}
                      </a>
                    ) : (
                      it.title
                    )}
                  </li>
                ))}
              </ul>
            )}
            {a.shift.connect && <p className="tp-connect">💡 {a.shift.connect}</p>}
            <p className="tp-blk-ask">면접 대응 — “최근 이슈 아는 거 있나요?” · “회사가 어떻게 발전할 것 같나요?”</p>
          </section>

          {/* ③ 경쟁 */}
          {a.competitors?.length > 0 && (
            <section className="tp-blk">
              <h2 className="tp-blk-head"><span>③</span> 경쟁 — 시장에서 어디에 서 있나</h2>
              <table className="tp-vs">
                <tbody>
                  {a.competitors.map((c, i) => (
                    <tr key={i}>
                      <th>{c.name}</th>
                      <td>{c.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {a.edge && <p className="tp-edge">이 회사만의 강점 — {a.edge}</p>}
              <p className="tp-blk-ask">면접 대응 — “왜 경쟁사가 아니라 우리 회사인가요?”</p>
            </section>
          )}

          {/* ④ 언어 */}
          <section className="tp-blk">
            <h2 className="tp-blk-head"><span>④</span> 언어 — 회사가 실제로 쓰는 단어</h2>
            <LanguageBars words={a.language ?? []} />
          </section>
        </>
      )}

      {/* ⑤ 직무 */}
      <section className="tp-blk">
        <h2 className="tp-blk-head"><span>⑤</span> 직무 — 내 직무와 어떻게 닿나</h2>

        {company.applications.length === 0 ? (
          <p className="tp-blk-body">
            아직 직무 분석이 없어요. 목록에서 이 회사에 <strong>직무를 넣어 분석</strong>하면 여기 붙어요.
          </p>
        ) : (
          <>
            {company.applications.length > 1 && (
              <div className="tp-choices" style={{ marginBottom: 14 }}>
                {company.applications.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className="tp-chip"
                    aria-pressed={openRole === app.id}
                    onClick={() => setOpenRole(app.id)}
                  >
                    {app.role}
                  </button>
                ))}
              </div>
            )}

            {current?.roleAnalysis ? (
              <>
                <p className="tp-blk-body">{current.roleAnalysis.linkToStrategy}</p>

                {current.roleAnalysis.requirements.length > 0 && (
                  <ul className="tp-check">
                    {current.roleAnalysis.requirements.map((r, i) => (
                      <li key={i}>☑ {r}</li>
                    ))}
                  </ul>
                )}

                {current.roleAnalysis.checkpoints.length > 0 && (
                  <div className="tp-sub tp-sub-tight">
                    <p className="tp-sub-title">자소서에서 짚을 것</p>
                    <ul className="tp-check">
                      {current.roleAnalysis.checkpoints.map((c, i) => (
                        <li key={i}>· {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="tp-blk-body">이 직무는 아직 분석 전이에요.</p>
            )}
          </>
        )}
      </section>

      {/* 출처 */}
      {a && a.sources && a.sources.length > 0 && (
        <details className="tp-sources">
          <summary>📎 참고한 자료 {a.sources.length}개 — 숫자와 최근 이슈는 직접 확인하세요</summary>
          <ul>
            {a.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="tp-entry-link">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 내 메모 — 재분석해도 지워지지 않는 유일한 칸 */}
      <section className="tp-blk is-note">
        <h2 className="tp-blk-head">📝 내 메모</h2>
        <p className="tp-sub-desc" style={{ margin: "0 0 8px" }}>
          설명회에서 들은 것, 현직자한테 물어본 것 — 검색으로는 못 얻는 제일 센 재료예요. 다시 분석해도 안 지워져요.
        </p>
        <textarea
          className="tp-textarea"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="예: 채용설명회에서 팀장이 '내부 도구 자동화'를 여러 번 강조함"
          style={{ width: "100%", boxSizing: "border-box" }}
        />
        <button className="tp-btn-sm" onClick={saveNotes} style={{ marginTop: 8 }}>
          {noteState === "saving" ? "저장 중..." : noteState === "saved" ? "저장됨!" : "💾 메모 저장"}
        </button>
      </section>
    </div>
  );
}
