"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readSse } from "@/lib/sse-client";

interface AppItem {
  id: string;
  role: string;
  analyzedAt: string | null;
}

interface CompanyItem {
  id: string;
  name: string;
  analyzedAt: string | null;
  applications: AppItem[];
}

export default function CompanyList() {
  const router = useRouter();

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/career/companies", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setCompanies(data.companies);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError("회사 목록을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // 이미 분석해 둔 회사인지 (다시 돌리면 덮어쓰므로 미리 알려준다)
  const existing = companies.find(
    (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.analyzedAt
  );

  const analyze = async () => {
    if (!name.trim()) {
      setError("회사명을 입력해주세요.");
      return;
    }
    setError("");
    setRunning(true);
    setProgress("분석을 준비하는 중...");

    try {
      const res = await fetch("/api/career/company/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok && res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setError(data.error || "기업 분석에 실패했습니다.");
        setRunning(false);
        return;
      }

      let goTo: string | null = null;

      await readSse(res, (event) => {
        if (event.type === "progress") {
          setProgress(event.message);
        } else if (event.type === "complete") {
          goTo = event.companyId;
        } else if (event.type === "error") {
          setError(event.message || "기업 분석에 실패했습니다.");
        }
      });

      const target = goTo as string | null;
      if (target) {
        router.push(`/career/companies/${target}`);
        return;
      }
      setRunning(false);
    } catch {
      setError("서버 오류가 발생했습니다.");
      setRunning(false);
    }
  };

  if (running) {
    return (
      <div className="ui-run">
        <p className="ui-run-msg">{progress}</p>
        <div className="ui-progress">
          <span className="ui-progress-fill is-indet" />
        </div>
        <p className="ui-hint">공개 자료를 찾아 읽는 중이에요. 30초쯤 걸려요.</p>
        {error && <p className="ui-note is-err">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <header className="ui-head">
        <h1>기업 분석</h1>
        <p>회사가 지금 어디로 가고 있는지 30분 안에 파악해요.</p>
      </header>

      {/* 새 분석 */}
      <div className="ui-panel ui-form">
        <label className="ui-field is-narrow">
          <span>🏢 어떤 회사를 볼까요?</span>
          <input
            className="ui-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 네이버"
          />
        </label>

        <p className="ui-hint">
          회사가 어디로 가는지만 봅니다.{" "}
          <strong>직무와 채용공고는 책상에서 지원 건을 만들 때</strong> 다뤄요 — 한 회사에 여러
          공고로 지원할 수 있으니까요.
        </p>

        {error && <p className="ui-note is-err">{error}</p>}

        {existing && (
          <p className="ui-hint">
            📁 {new Date(existing.analyzedAt!).toLocaleDateString("ko-KR")} 기준 분석이 이미 있어요.
            다시 돌리면 덮어씁니다. (내 메모는 그대로 남아요)
          </p>
        )}

        <div className="ui-actions is-end">
          <button type="button" className="ui-btn" onClick={analyze}>
            {existing ? "🔄 다시 분석하기" : "🔎 분석 시작"}
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading && <p className="ui-note">회사 목록을 불러오는 중…</p>}

      {!loading && companies.length === 0 && (
        <div className="ui-empty">
          <h3>아직 분석한 회사가 없어요</h3>
          <p>위에 회사명을 넣고 시작해보세요.</p>
        </div>
      )}

      {!loading && companies.length > 0 && (
        <section className="ui-sec">
          <div className="ui-sec-head">
            <h2>분석해 둔 회사</h2>
            <p>{companies.length}곳</p>
          </div>

          <div className="ui-grid">
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                className="ui-panel is-click"
                onClick={() => router.push(`/career/companies/${c.id}`)}
              >
                <h3>{c.name}</h3>
                <p className="ui-hint">
                  {c.analyzedAt
                    ? `${new Date(c.analyzedAt).toLocaleDateString("ko-KR")} 기준`
                    : "분석 전"}
                </p>
                {c.applications.length > 0 && (
                  <div className="ui-actions" style={{ marginTop: 4 }}>
                    {c.applications.map((a) => (
                      <span key={a.id} className="ui-chip">
                        {a.role}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
