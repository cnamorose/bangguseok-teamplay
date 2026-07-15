"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ResultItem {
  id: string;
  topic: string;
  createdAt: string;
  assembly: { name: string };
}

export default function BookshelfPage() {
  const router = useRouter();
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/results")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setResults(data.results);
      })
      .catch(() => setError("책장을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40 }}>책장을 불러오는 중...</div>;
  if (error) return <div style={{ padding: 40, color: "red" }}>{error}</div>;

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28 }}>내 책장</h1>
        <button
          onClick={() => router.push("/create")}
          style={{ padding: "8px 16px", background: "#000", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          + 새 팀플
        </button>
      </div>

      {results.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
          아직 저장된 팀플이 없어요.<br />
          첫 팀플을 만들어보세요!
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {results.map((item) => (
            <div
              key={item.id}
              onClick={() => router.push(`/result/${item.id}`)}
              style={{
                padding: 20,
                border: "1px solid #eee",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 6 }}>{item.topic}</h3>
              <p style={{ color: "#888", fontSize: 14 }}>
                {item.assembly.name} · {new Date(item.createdAt).toLocaleString("ko-KR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}