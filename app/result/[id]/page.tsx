"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface AgentLog {
  id: string;
  stage: string;
  persona: string;
  status: string;
  output: any;
}

interface ResultData {
  id: string;
  topic: string;
  resultData: any;
  filePath: string | null; 
  assembly: {
    name: string;
    searchPersona: string;
    generatePersona: string;
    organizePersona: string;
    visualizePersona: string;
  };
  agentLogs: AgentLog[];
}



const STAGE_LABEL: Record<string, string> = {
  search: "🔍 서치",
  generate: "📝 생성",
  organize: "✨ 정리",
  visualize: "📊 시각화",
  critic: "🎯 비평가", 
};

export default function ResultPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/result/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setResult(data.result);
      })
      .catch(() => setError("결과를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 40 }}>결과를 불러오는 중...</div>;
  if (error) return <div style={{ padding: 40, color: "red" }}>{error}</div>;
  if (!result) return null;

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{result.topic}</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>{result.assembly.name}</p>

      {/* 다운로드 + 책장 버튼 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {result.filePath && (
           <a
            href={result.filePath}
            download={`${result.topic}.${result.filePath.split(".").pop()}`}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#000",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            📥 결과물 다운로드
          </a>
        )}

        <button
          onClick={() => router.push("/bookshelf")}
          style={{
            padding: "10px 20px",
            background: "#fff",
            color: "#000",
            border: "1px solid #000",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          📚 책장으로
        </button>
      </div>
      

      {/* 단계별 결과 */}
      {result.agentLogs.map((log) => (
        <div
          key={log.id}
          style={{
            marginBottom: 24,
            padding: 20,
            border: "1px solid #eee",
            borderRadius: 12,
          }}
        >
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>
            {STAGE_LABEL[log.stage] || log.stage}
          </h3>
          <StageOutput stage={log.stage} output={log.output} />
        </div>
      ))}
    </div>
  );
}

// 단계별로 출력 형태가 달라서 각각 맞게 보여줌
function StageOutput({ stage, output }: { stage: string; output: any }) {
    if (stage === "search") {
  return (
    <div>
      <strong>핵심 포인트</strong>
      <ul>
        {output.keyPoints?.map((p: string, i: number) => (
          <li key={i}>{p}</li>
        ))}
      </ul>

      <strong>출처</strong>
      <ul>
        {output.sources?.map((s: string, i: number) => {
          // "제목 (https://...)" 형태에서 URL 추출
          const match = s.match(/^(.*)\s\((https?:\/\/[^)]+)\)$/);

          if (match) {
            const [, title, url] = match;

            return (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#0066cc",
                    textDecoration: "underline",
                  }}
                >
                  {title}
                </a>
              </li>
            );
          }

          // 형식이 안 맞으면 그냥 텍스트
          return <li key={i}>{s}</li>;
        })}
      </ul>
    </div>
  );
}

  if (stage === "generate" || stage === "organize") {
    return (
      <div>
        <h4 style={{ marginBottom: 8 }}>{output.title}</h4>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{output.content}</p>
        {output.feedback && (
          <p style={{ marginTop: 12, color: "#888", fontSize: 14 }}>
            💬 {output.feedback}
          </p>
        )}
      </div>
    );
  }

  if (stage === "visualize") {
    return (
      <div>
        <h4 style={{ marginBottom: 8 }}>{output.title}</h4>
        {output.sections?.map((section: any, i: number) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <strong>{section.heading}</strong>
            <ul>
              {section.content?.map((c: string, j: number) => <li key={j}>{c}</li>)}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (stage === "critic") {
    return (
      <div>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 10,
            background: output.pass ? "#e6f4ea" : "#fdeaea",
            color: output.pass ? "#137333" : "#c5221f",
          }}
        >
          {output.pass ? "✅ 통과" : "🔄 수정 요청"}
        </div>
        <p style={{ fontStyle: "italic", marginBottom: 8, lineHeight: 1.6 }}>
          💬 “{output.comment}”
        </p>
        {output.feedback && (
          <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>
            <strong>피드백:</strong> {output.feedback}
          </p>
        )}
      </div>
    );
  }

  return <pre>{JSON.stringify(output, null, 2)}</pre>;
}