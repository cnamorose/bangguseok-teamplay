"use client";

import Loading from "@/app/components/Loading";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ddayLabel, isUrgent, statusLabel } from "./desk/status";

// 취업방 홈. 공부방과 같은 골격이되, 여기서 제일 중요한 건 마감이다.

interface AppRow {
  id: string;
  role: string;
  deadline: string | null;
  status: string;
  analyzedAt: string | null;
  company: { id: string; name: string; analyzedAt: string | null };
  essays: { id: string; charCount: number }[];
}

const CAST = [
  { emoji: "🧰", name: "내 경험", href: "/career/experience" },
  { emoji: "🏢", name: "기업 분석", href: "/career/companies" },
  { emoji: "📝", name: "자소서", href: "/career/resume" },
  { emoji: "🎤", name: "면접", href: "/career/interview" },
];

export default function CareerHome({ userName }: { userName: string }) {
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [expCount, setExpCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/career/applications").then((r) => r.json()),
      fetch("/api/career/experiences").then((r) => r.json()),
    ])
      .then(([a, e]) => {
        if (a.error) setError(a.error);
        else setApps(a.applications);
        if (!e.error) setExpCount(e.experiences.length);
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const essays = apps.reduce((n, a) => n + a.essays.length, 0);
    const written = apps.reduce((n, a) => n + a.essays.filter((e) => e.charCount > 0).length, 0);
    const urgent = apps.filter((a) => isUrgent(a.deadline, a.status));
    return { essays, written, urgent };
  }, [apps]);

  if (loading) return <Loading label="불러오는 중…" />;

  return (
    <>
      <header className="ui-head">
        <h1>안녕하세요, {userName}님</h1>
        <p>
          {apps.length > 0
            ? `지원 건 ${apps.length}개를 준비하고 있어요.`
            : "아직 준비 중인 지원 건이 없어요."}
        </p>
      </header>

      {error && <p className="ui-note is-err">{error}</p>}

      <div className="ui-tiles">
        <div className="ui-tile">
          <span className="ui-tile-n">{apps.length}</span>
          <span className="ui-tile-l">지원 건</span>
        </div>
        <div className="ui-tile">
          <span className="ui-tile-n">
            {stats.written}
            <em>/{stats.essays}</em>
          </span>
          <span className="ui-tile-l">자소서 문항</span>
        </div>
        <div className="ui-tile">
          <span className="ui-tile-n">{expCount}</span>
          <span className="ui-tile-l">정리한 경험</span>
        </div>
      </div>

      {/* 경험이 없으면 그것부터. 자소서가 여기서 나온다 */}
      {expCount === 0 ? (
        <section className="ui-nudge">
          <p>
            <strong>경험을 먼저 정리해주세요.</strong> 자소서는 내 경험에서 나와요.
            떠오르는 대로 적으면 항목별로 나눠드릴게요.
          </p>
          <button className="ui-btn ui-btn-ghost" onClick={() => router.push("/career/experience")}>
            경험 정리하러 가기
          </button>
        </section>
      ) : stats.urgent.length > 0 ? (
        <section className="ui-nudge">
          <p>
            <strong>마감이 가까운 지원 건이 {stats.urgent.length}개</strong> 있어요.
            {stats.urgent[0] && ` ${stats.urgent[0].company.name} · ${stats.urgent[0].role}가 ${ddayLabel(stats.urgent[0].deadline)}예요.`}
          </p>
          <button className="ui-btn ui-btn-ghost" onClick={() => router.push("/career/desk")}>
            책장에서 보기
          </button>
        </section>
      ) : null}

      {/* 준비 단계 */}
      <section className="ui-cast">
        {CAST.map((c) => (
          <button
            key={c.name}
            className="ui-cast-one"
            style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}
            onClick={() => router.push(c.href)}
          >
            <span className="ui-face">{c.emoji}</span>
            {c.name}
          </button>
        ))}
      </section>

      <section className="ui-sec">
        <div className="ui-sec-head">
          <h2>지원 건</h2>
          <button className="ui-more" onClick={() => router.push("/career/desk")}>
            책장 전체 보기 →
          </button>
        </div>

        {apps.length === 0 ? (
          <div className="ui-empty">
            <h3>아직 지원 건이 없어요</h3>
            <p>회사를 분석하고 채용공고를 넣으면 여기 쌓입니다.</p>
            <button className="ui-btn" onClick={() => router.push("/career/companies")}>
              기업 분석하러 가기
            </button>
          </div>
        ) : (
          <div className="ui-shelf">
            {apps.slice(0, 5).map((a, i) => {
              const dday = ddayLabel(a.deadline);
              const written = a.essays.filter((e) => e.charCount > 0).length;
              return (
                <article
                  key={a.id}
                  className="ui-book"
                  style={{ ["--tilt" as string]: `${(i % 3) - 1}deg` }}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/career/desk/${a.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/career/desk/${a.id}`)}
                >
                  <span
                    className="ui-tab"
                    style={{ background: `var(--book-${(i % 6) + 1})` }}
                  />
                  <h3>{a.company.name}</h3>
                  <p className="ui-book-sub">{a.role}</p>
                  <p className="ui-book-date">
                    {dday ? `${dday} · ` : ""}
                    {statusLabel(a.status)}
                    {a.essays.length > 0 && ` · 자소서 ${written}/${a.essays.length}`}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
