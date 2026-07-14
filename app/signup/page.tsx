"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>회원가입</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <input
          type="text"
          placeholder="이름 (선택)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />
        {error && <p style={{ color: "red", fontSize: 14 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, background: "#000", color: "#fff", borderRadius: 6, cursor: "pointer" }}
        >
          {loading ? "처리 중..." : "회원가입"}
        </button>
      </form>
    </div>
  );
}