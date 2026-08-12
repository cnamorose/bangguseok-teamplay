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
  const [role, setRole] = useState("");
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

  // 이미 분석해 둔 회사인지 (같은 이름이면 회사 분석을 재사용할지 물어본다)
  const existing = companies.find(
    (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.analyzedAt
  );

  const analyze = async (reuse: boolean) => {
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
        body: JSON.stringify({ name: name.trim(), role: role.trim(), reuse }),
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
      <div className="tp-progress-wrap">
        <p className="tp-progress-msg">{progress}</p>
        <div className="tp-progress-bar">
          <div className="tp-progress-fill tp-progress-indet" />
        </div>
        <p className="tp-sub-desc" style={{ marginTop: 12 }}>
          공개 자료를 찾아 읽는 중이에요. 30초쯤 걸려요.
        </p>
        {error && <p className="tp-note tp-note-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="tp-career-col">
      {/* 새 분석 */}
      <div className="tp-panel">
        <p className="tp-col-title">🏢 어떤 회사를 볼까요?</p>

        <label className="tp-field">
          <span className="tp-label">회사명</span>
          <input
            className="tp-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 네이버"
          />
        </label>

        <label className="tp-field">
          <span className="tp-label">
            지원 직무 <span className="tp-optional">(선택 · 넣으면 직무 분석까지)</span>
          </span>
          <input
            className="tp-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="예: 백엔드 개발"
          />
          <span className="tp-sub-desc" style={{ margin: 0 }}>
            회사 분석은 직무와 상관없이 한 번만 하면 돼요. 직무를 바꿔 가며 여러 번 볼 수 있어요.
          </span>
        </label>

        {error && <p className="tp-error">{error}</p>}

        {existing ? (
          <div className="tp-sub">
            <p className="tp-sub-title">📁 이미 분석해 둔 회사예요</p>
            <p className="tp-sub-desc">
              {new Date(existing.analyzedAt!).toLocaleDateString("ko-KR")} 기준 분석이 있어요.
              그대로 쓰면 직무 분석만 새로 하니 훨씬 빨라요.
            </p>
            <div className="tp-choices">
              <button type="button" className="tp-btn" onClick={() => analyze(true)}>
                📁 기존 분석 쓰기
              </button>
              <button type="button" className="tp-btn-outline" onClick={() => analyze(false)}>
                🔄 새로 분석하기
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="tp-btn" onClick={() => analyze(false)}>
            🔎 분석 시작
          </button>
        )}
      </div>

      {/* 목록 */}
      {loading && <p className="tp-note">회사 목록을 불러오는 중...</p>}

      {!loading && companies.length === 0 && (
        <div className="tp-shelf-empty">
          아직 분석한 회사가 없어요.
          <br />위에 회사명을 넣고 시작해보세요!
        </div>
      )}

      {!loading && companies.length > 0 && (
        <div className="tp-company-grid">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              className="tp-company-card"
              onClick={() => router.push(`/career/companies/${c.id}`)}
            >
              <h3 className="tp-company-name">{c.name}</h3>
              <p className="tp-company-date">
                {c.analyzedAt
                  ? `${new Date(c.analyzedAt).toLocaleDateString("ko-KR")} 기준`
                  : "분석 전"}
              </p>
              {c.applications.length > 0 && (
                <div className="tp-company-roles">
                  {c.applications.map((a) => (
                    <span key={a.id} className="tp-role-chip">{a.role}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
