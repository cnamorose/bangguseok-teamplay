"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseSource } from "@/lib/parse-source";
import { extractArticleText } from "@/lib/result-text";
import ShareButton from "@/app/components/ShareButton";

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
  createdAt?: string;
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
  director: "🎬 편집장 결정",
};

const DIRECTOR_ACTION_LABEL: Record<string, string> = {
  research: "🔍 추가 리서치 지시",
  rewrite: "✍️ 다시 쓰기 지시",
  finalize: "✅ 마무리 결정",
};

export default function ResultView({ id }: { id: string }) {
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

  if (loading) return <p className="tp-note">책을 펼치는 중...</p>;
  if (error) return <p className="tp-note tp-note-error">{error}</p>;
  if (!result) return null;

  return (
    <article className="tp-book-open">
      {/* 왼쪽 면: 속표지 */}
      <div className="tp-page tp-page-left">
        <h1 className="tp-page-title">{result.topic}</h1>
        <p className="tp-page-sub">{result.assembly?.name}</p>
        {result.createdAt && (
          <p className="tp-page-date">
            {new Date(result.createdAt).toLocaleDateString("ko-KR")}
          </p>
        )}

        <hr className="tp-rule" />

        <div className="tp-page-actions">
          {result.filePath && (
            <a className="tp-btn-download" href={result.filePath} download>
              📥 결과물 다운로드
            </a>
          )}
          <button
            className="tp-btn-download"
            onClick={() => {
              const text = extractArticleText(result.resultData);
              // 평가 페이지가 마운트될 때 읽어서 주제/글을 자동으로 채운다.
              sessionStorage.setItem(
                "evaluate:prefill",
                JSON.stringify({ topic: result.topic, text })
              );
              router.push("/study/evaluate");
            }}
          >
            🧑‍⚖️ 평가단에게 평가받기
          </button>
          <ShareButton kind="result" targetId={id} />
          <button className="tp-btn-outline" onClick={() => router.push("/study/bookshelf")}>
            📚 책장으로
          </button>
        </div>
      </div>

      {/* 오른쪽 면: 단계별 결과 */}
      <div className="tp-page tp-page-right">
        {result.agentLogs.map((log) => (
          <section className="tp-entry" key={log.id}>
            <h3 className="tp-entry-head">{STAGE_LABEL[log.stage] || log.stage}</h3>
            <StageOutput stage={log.stage} output={log.output} />
          </section>
        ))}
      </div>
    </article>
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
            const { title, url } = parseSource(s);

            if (url) {
              return (
                <li key={i}>
                  <a
                    className="tp-entry-link"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {title}
                  </a>
                </li>
              );
            }

            // URL이 없으면 그냥 텍스트
            return <li key={i}>{s}</li>;
          })}
        </ul>
      </div>
    );
  }

  if (stage === "generate" || stage === "organize") {
    return (
      <div>
        <h4>{output.title}</h4>
        <p className="tp-entry-body">{output.content}</p>
        {output.feedback && <p className="tp-entry-note">💬 {output.feedback}</p>}
      </div>
    );
  }

  if (stage === "visualize") {
    return (
      <div>
        <h4>{output.title}</h4>
        {output.sections?.map((section: any, i: number) => (
          <div key={i}>
            <strong>{section.heading}</strong>
            <ul>
              {section.content?.map((c: string, j: number) => (
                <li key={j}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (stage === "director") {
    return (
      <div>
        <div className="tp-badge tp-badge-pass">
          {DIRECTOR_ACTION_LABEL[output.action] || output.action}
        </div>
        <p className="tp-entry-note">{output.reason}</p>
        {output.query && (
          <p className="tp-entry-note">
            <strong>검색어:</strong> {output.query}
          </p>
        )}
      </div>
    );
  }

  if (stage === "critic") {
    return (
      <div>
        <div className={`tp-badge ${output.pass ? "tp-badge-pass" : "tp-badge-fail"}`}>
          {output.pass ? "✅ 통과" : "🔄 수정 요청"}
        </div>
        <p className="tp-entry-quote">💬 “{output.comment}”</p>
        {output.feedback && (
          <p className="tp-entry-note">
            <strong>피드백:</strong> {output.feedback}
          </p>
        )}
      </div>
    );
  }

  return <pre className="tp-entry-raw">{JSON.stringify(output, null, 2)}</pre>;
}
