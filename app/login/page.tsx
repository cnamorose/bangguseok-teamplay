"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Shelves from "@/app/components/Shelves";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }

      // 성공하면 서버가 알려준 곳(메인 페이지)으로 이동
      router.push(data.redirectTo || "/study/bookshelf");
      router.refresh();
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tp-wall">
      {/* 배경 책장 (장식) */}
      <Shelves />

      {/* 로그인 카드 */}
      <div className="tp-card">
        <div className="tp-card-header">
          <h1>🏠 방구석 팀플</h1>
          <p>내 방 책장에서 시작하는 팀 프로젝트</p>
        </div>

        <form onSubmit={handleSubmit} className="tp-card-body">
          <label className="tp-field">
            <span className="tp-label">이메일</span>
            <input
              className="tp-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="tp-field">
            <span className="tp-label">비밀번호</span>
            <input
              className="tp-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <p className="tp-error">{error}</p>}

          <button className="tp-btn" type="submit" disabled={loading}>
            {loading ? "여는 중..." : "📖 책장 열기"}
          </button>

          <p className="tp-signup">
            아직 방이 없나요?{" "}
            <a href="/signup" className="tp-link">방 만들기 →</a>
          </p>
        </form>
      </div>
    </div>
  );
}
