"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookSpines from "@/app/components/BookSpines";

// 껍데기(Shell) 밖에 있는 화면이라 틀(.ui-page)과 밝기를 직접 세운다.

const MODE_KEY = "tp-mode";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(localStorage.getItem(MODE_KEY) === "dark");
  }, []);

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
      router.push(data.redirectTo || "/study");
      router.refresh();
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page ui-auth" data-mode={dark ? "dark" : "light"}>
      <div className="ui-auth-card">
        <div>
          <BookSpines />
          <h1 style={{ marginTop: 18 }}>🏠 방구석 스터디</h1>
          <p>내 방 책장에서 시작하는 공부와 취업 준비</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="ui-field">
            <span>이메일</span>
            <input
              className="ui-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="ui-field">
            <span>비밀번호</span>
            <input
              className="ui-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <p className="ui-note is-err">{error}</p>}

          <button
            className="ui-btn"
            type="submit"
            disabled={loading}
            style={{ justifyContent: "center" }}
          >
            {loading ? "여는 중…" : "📖 책장 열기"}
          </button>
        </form>

        <p className="ui-auth-foot">
          아직 방이 없나요? <a href="/signup">방 만들기 →</a>
        </p>
      </div>
    </div>
  );
}
