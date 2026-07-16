"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Shelves from "@/app/components/Shelves";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }

      // 성공하면 로그인 페이지로 이동
      alert("회원가입 성공! 로그인해주세요.");
      router.push("/login");
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

      {/* 회원가입 카드 */}
      <div className="tp-card">
        <div className="tp-card-header">
          <h1>🏠 방 만들기</h1>
          <p>나만의 책장을 차릴 방을 마련해요</p>
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
              autoComplete="new-password"
            />
          </label>

          <label className="tp-field">
            <span className="tp-label">이름 <span className="tp-optional">(선택)</span></span>
            <input
              className="tp-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>

          {error && <p className="tp-error">{error}</p>}

          <button className="tp-btn" type="submit" disabled={loading}>
            {loading ? "짓는 중..." : "🔑 방 만들기"}
          </button>

          <p className="tp-signup">
            이미 방이 있나요?{" "}
            <a href="/login" className="tp-link">책장 열기 →</a>
          </p>
        </form>
      </div>
    </div>
  );
}
