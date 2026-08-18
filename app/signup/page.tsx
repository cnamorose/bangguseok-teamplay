"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookSpines from "@/app/components/BookSpines";

// 껍데기(Shell) 밖에 있는 화면이라 틀(.ui-page)과 밝기를 직접 세운다.

const MODE_KEY = "tp-mode";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
    <div className="ui-page ui-auth" data-mode={dark ? "dark" : "light"}>
      <div className="ui-auth-card">
        <div>
          <BookSpines />
          <h1 style={{ marginTop: 18 }}>🏠 방 만들기</h1>
          <p>나만의 책장을 차릴 방을 마련해요</p>
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
              autoComplete="new-password"
            />
          </label>

          <label className="ui-field">
            <span>
              이름 <em>(선택)</em>
            </span>
            <input
              className="ui-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>

          {error && <p className="ui-note is-err">{error}</p>}

          <button
            className="ui-btn"
            type="submit"
            disabled={loading}
            style={{ justifyContent: "center" }}
          >
            {loading ? "짓는 중…" : "🔑 방 만들기"}
          </button>
        </form>

        <p className="ui-auth-foot">
          이미 방이 있나요? <a href="/login">책장 열기 →</a>
        </p>
      </div>
    </div>
  );
}
