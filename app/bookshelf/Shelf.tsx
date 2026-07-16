"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ResultItem {
  id: string;
  topic: string;
  createdAt: string;
  assembly: { name: string };
}

// 책 표지 색 팔레트 (책장 장식과 같은 톤)
const COVERS = [
  "#c67a52",
  "#cf8f5f",
  "#d3a85e",
  "#8faf74",
  "#7f9a6b",
  "#6d94b0",
  "#9a7bb5",
  "#b05f5f",
];

// id를 해시해서 색을 고른다.
// 매 렌더마다 Math.random()을 쓰면 새로고침할 때마다 색이 바뀌고
// 서버/클라이언트 렌더가 어긋나므로, 책마다 색이 고정되도록 id에서 뽑는다.
function coverColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COVERS[Math.abs(hash) % COVERS.length];
}

// 한 선반에 5권씩 나눠 담기
const PER_SHELF = 5;

function chunk<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

export default function Shelf() {
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

  return (
    <>
      {loading && <p className="tp-note">책장을 불러오는 중...</p>}
      {error && <p className="tp-note tp-note-error">{error}</p>}

      {!loading && !error && results.length === 0 && (
        <div className="tp-shelf-empty">
          아직 책장에 꽂힌 팀플이 없어요.
          <br />첫 팀플을 만들어 책장을 채워보세요!
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="tp-display">
          {chunk(results, PER_SHELF).map((row, i) => (
            <div className="tp-shelf-unit" key={i}>
              <div className="tp-shelf-row">
                {row.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="tp-book-cover"
                    style={{ background: coverColor(item.id) }}
                    onClick={() => router.push(`/result/${item.id}`)}
                  >
                    <div className="tp-book-label">
                      <h3 className="tp-book-title">{item.topic}</h3>
                    </div>
                    <p className="tp-book-meta">
                      {item.assembly.name}
                      <br />
                      {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </button>
                ))}
              </div>
              <div className="tp-plank" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
