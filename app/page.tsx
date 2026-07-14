"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string | null;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 페이지 열릴 때 현재 로그인 상태 확인
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // 로그아웃 처리
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  };

  if (loading) {
    return <div style={{ padding: 40 }}>로딩 중...</div>;
  }

  return (
    <div style={{ maxWidth: 600, margin: "80px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>방구석 팀플</h1>

      {user ? (
        // 로그인된 상태
        <div>
          <p style={{ marginBottom: 16 }}>
            <strong>{user.name || user.email}</strong>님, 환영합니다!
          </p>
          <button
            onClick={handleLogout}
            style={{ padding: "8px 16px", background: "#000", color: "#fff", borderRadius: 6, cursor: "pointer" }}
          >
            로그아웃
          </button>
        </div>
      ) : (
        // 로그아웃 상태
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => router.push("/login")}
            style={{ padding: "8px 16px", background: "#000", color: "#fff", borderRadius: 6, cursor: "pointer" }}
          >
            로그인
          </button>
          <button
            onClick={() => router.push("/signup")}
            style={{ padding: "8px 16px", background: "#fff", color: "#000", border: "1px solid #000", borderRadius: 6, cursor: "pointer" }}
          >
            회원가입
          </button>
        </div>
      )}
    </div>
  );
}