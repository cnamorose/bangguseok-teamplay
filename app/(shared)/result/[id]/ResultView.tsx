"use client";

import Loading from "@/app/components/Loading";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseSource } from "@/lib/parse-source";
import { extractArticleText } from "@/lib/result-text";
import ShareButton from "@/app/components/ShareButton";

// 결과물 한 편.
//
// 예전엔 단계별 기록을 전부 같은 크기로 늘어놓아서, 정작 읽으러 온 글이
// 검색 로그와 비평가 코멘트 사이에 묻혀 있었다.
// 이제 완성된 글을 먼저 크게 놓되, 과정은 접지 않고 아래에 그대로 편다 —
// 누가 무엇을 보고 무엇을 냈는지가 이 앱이 보여주려는 것이라 숨길 이유가 없다.

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
  } | null;
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

/**
 * 읽을 글을 고른다.
 * 정리(organize)가 생성(generate)을 다듬은 결과라 그쪽이 우선이고,
 * 같은 단계가 여러 번 돌았으면 마지막 것이 최종본이다.
 */
function pickFinal(logs: AgentLog[]) {
  const last = (stage: string) =>
    [...logs].reverse().find((l) => l.stage === stage && l.output?.content);
  const log = last("organize") || last("generate");
  return log?.output as { title?: string; content: string } | undefined;
}

function pickVisual(logs: AgentLog[]) {
  const log = [...logs].reverse().find((l) => l.stage === "visualize" && l.output?.sections?.length);
  return log?.output as
    | { title?: string; sections: { heading: string; content?: string[] }[] }
    | undefined;
}

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

  if (loading) return <Loading label="불러오는 중…" />;
  if (error) return <p className="ui-note is-err">{error}</p>;
  if (!result) return null;

  const doc = pickFinal(result.agentLogs);
  const visual = pickVisual(result.agentLogs);

  const toEvaluate = () => {
    const text = extractArticleText(result.resultData);
    // 평가 페이지가 마운트될 때 읽어서 주제/글을 자동으로 채운다.
    sessionStorage.setItem("evaluate:prefill", JSON.stringify({ topic: result.topic, text }));
    router.push("/study/evaluate");
  };

  return (
    <>
      <header className="ui-head">
        <h1>{result.topic}</h1>
        <p>
          {result.assembly?.name}
          {result.assembly?.name && result.createdAt && " · "}
          {result.createdAt && new Date(result.createdAt).toLocaleDateString("ko-KR")}
        </p>
      </header>

      <div className="ui-actions">
        <button className="ui-btn" onClick={toEvaluate}>
          🧑‍⚖️ 평가단에게 보내기
        </button>
        {result.filePath && (
          <a className="ui-btn ui-btn-ghost" href={result.filePath} download>
            📥 내려받기
          </a>
        )}
        <ShareButton kind="result" targetId={id} />
        <button
          className="ui-btn ui-btn-ghost"
          style={{ marginLeft: "auto" }}
          onClick={() => router.push("/study/bookshelf")}
        >
          📚 책장으로
        </button>
      </div>

      {doc ? (
        <article className="ui-doc">
          {doc.title && <h2>{doc.title}</h2>}
          <p className="ui-doc-body">{doc.content}</p>
        </article>
      ) : (
        <div className="ui-empty">
          <h3>완성된 글이 없어요</h3>
          <p>만드는 도중에 멈춘 것 같아요. 아래에서 어디까지 갔는지 볼 수 있어요.</p>
        </div>
      )}

      {visual && (
        <section className="ui-sec">
          <div className="ui-sec-head">
            <h2>{visual.title || "글의 뼈대"}</h2>
            <p>시각화 담당이 잡은 구성</p>
          </div>
          <div className="ui-grid">
            {visual.sections.map((section, i) => (
              <div className="ui-panel" key={i}>
                <h3>{section.heading}</h3>
                <ul className="ui-list">
                  {section.content?.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {result.agentLogs.length > 0 && (
        <section className="ui-sec">
          <div className="ui-sec-head">
            <h2>🧩 팀이 한 일</h2>
            <p>{result.agentLogs.length}단계 · 누가 무엇을 보고 무엇을 냈는지</p>
          </div>

          <ol className="ui-steps">
            {result.agentLogs.map((log, i) => (
              <li className="ui-step" key={log.id}>
                <h3 className="ui-step-head">
                  <span className="ui-step-n">{i + 1}</span>
                  {STAGE_LABEL[log.stage] || log.stage}
                  {log.status === "failed" && <span className="ui-badge is-fail">실패</span>}
                </h3>

                {/* 담당자를 어떤 성격으로 세웠는지 — 결과를 읽는 기준이 된다 */}
                {log.persona && <p className="ui-step-who">“{log.persona}”</p>}

                <div className="ui-step-body">
                  <StageOutput stage={log.stage} output={log.output} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

// 단계마다 나오는 모양이 달라서 각각 맞게 보여준다
function StageOutput({ stage, output }: { stage: string; output: any }) {
  if (!output) return <p className="ui-step-text">남은 기록이 없어요.</p>;

  if (stage === "search") {
    return (
      <>
        {output.keyPoints?.length > 0 && (
          <>
            <p className="ui-step-label">핵심 포인트</p>
            <ul className="ui-list">
              {output.keyPoints.map((p: string, i: number) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </>
        )}

        {output.sources?.length > 0 && (
          <>
            <p className="ui-step-label">출처</p>
            <ul className="ui-list">
              {output.sources.map((s: string, i: number) => {
                const { title, url } = parseSource(s);

                // URL이 없으면 그냥 텍스트
                if (!url) return <li key={i}>{s}</li>;

                return (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </>
    );
  }

  if (stage === "generate" || stage === "organize") {
    return (
      <>
        {output.title && <h4>{output.title}</h4>}
        <p className="ui-step-text">{output.content}</p>
        {output.feedback && <p className="ui-step-note">💬 {output.feedback}</p>}
      </>
    );
  }

  if (stage === "visualize") {
    return (
      <>
        {output.title && <h4>{output.title}</h4>}
        {output.sections?.map((section: any, i: number) => (
          <div key={i}>
            <p className="ui-step-label">{section.heading}</p>
            <ul className="ui-list">
              {section.content?.map((c: string, j: number) => (
                <li key={j}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </>
    );
  }

  if (stage === "director") {
    return (
      <>
        <span className="ui-badge is-pass">
          {DIRECTOR_ACTION_LABEL[output.action] || output.action}
        </span>
        {output.reason && <p className="ui-step-note">{output.reason}</p>}
        {output.query && (
          <p className="ui-step-note">
            <strong>검색어:</strong> {output.query}
          </p>
        )}
      </>
    );
  }

  if (stage === "critic") {
    return (
      <>
        <span className={`ui-badge ${output.pass ? "is-pass" : "is-fail"}`}>
          {output.pass ? "✅ 통과" : "🔄 수정 요청"}
        </span>
        {output.comment && <p className="ui-step-note">💬 “{output.comment}”</p>}
        {output.feedback && (
          <p className="ui-step-note">
            <strong>피드백:</strong> {output.feedback}
          </p>
        )}
      </>
    );
  }

  return <pre className="ui-raw">{JSON.stringify(output, null, 2)}</pre>;
}
