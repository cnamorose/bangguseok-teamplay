"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { diffWords } from "diff";

interface EvalResult {
  evaluatorId: string;
  evaluatorName: string;
  scoreLabel: string;
  score: number;
  maxScore: number;
  comment: string;
  sources?: string[];
}

interface ChatMessage {
  speakerId: string;
  speakerName: string;
  message: string;
}

// 평가단 명단 (평가 전에도 미리 보여줌)
const EVALUATORS = [
  { id: "chief", name: "평가원", emoji: "🎓", role: "전체 완성도를 종합적으로 봐요", scoreLabel: "종합", maxScore: 100 },
  { id: "librarian", name: "인간 도서관", emoji: "📚", role: "주장·통계의 근거를 따져요", scoreLabel: "사실성", maxScore: 10 },
  { id: "wordsmith", name: "글조합 천재", emoji: "✍️", role: "문장·구성·표현을 다듬어요", scoreLabel: "정교함", maxScore: 10 },
];

// 채팅 화자별 아바타 + 위치
const SPEAKER: Record<string, { emoji: string; side: "left" | "right" | "center" }> = {
  librarian: { emoji: "📚", side: "left" },
  wordsmith: { emoji: "✍️", side: "right" },
  chief: { emoji: "🎓", side: "center" },
};

function SourceList({ sources }: { sources: string[] }) {
  return (
    <div className="tp-eval-src">
      <p className="tp-eval-src-title">참고한 자료</p>
      <ul>
        {sources.map((s, i) => {
          const match = s.match(/^(.*)\s\((https?:\/\/[^)]+)\)$/);
          return (
            <li key={i}>
              {match ? (
                <a className="tp-entry-link" href={match[2]} target="_blank" rel="noopener noreferrer">
                  {match[1]}
                </a>
              ) : (
                s
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Evaluate() {
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<EvalResult[]>([]);
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);

  // 논의 관련
  const [librarianTurns, setLibrarianTurns] = useState(2);
  const [wordsmithTurns, setWordsmithTurns] = useState(2);
  const [discussing, setDiscussing] = useState(false);
  const [discussStarted, setDiscussStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [discussProgress, setDiscussProgress] = useState("");
  const [revisedText, setRevisedText] = useState("");
  // 논의 시작 시점의 원본 (비교 기준 — 이후 입력칸을 고쳐도 디프가 안 흔들리게)
  const [originalForDiff, setOriginalForDiff] = useState("");

  // 우측 페이지 인덱스
  const [page, setPage] = useState(0);

  // 새 메시지가 오면 채팅 맨 아래로 스크롤
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, discussing]);

  // 평가가 도착하면 그 평가자 페이지로 자동 이동
  useEffect(() => {
    if (results.length === 0) return;
    const lastId = results[results.length - 1].evaluatorId;
    const i = EVALUATORS.findIndex((e) => e.id === lastId);
    if (i >= 0) setPage(i);
  }, [results]);

  // 논의를 시작하면 회의 페이지로 (수정본은 회의 페이지 우측에 함께 뜸)
  useEffect(() => {
    if (discussStarted) setPage(EVALUATORS.length); // 회의 페이지
  }, [discussStarted]);

  // 파일 업로드 → 파싱 → 주제/글 채우기
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 동작하게 초기화
    if (!file) return;

    setError("");
    setParsing(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/evaluate/parse-file", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "파일을 읽지 못했습니다.");
        return;
      }

      setTopic(data.topic);
      setText(data.text);
    } catch {
      setError("파일 업로드에 실패했습니다.");
    } finally {
      setParsing(false);
    }
  };

  // 전부 비우고 처음부터 (다른 글을 평가받고 싶을 때)
  const handleReset = () => {
    setTopic("");
    setText("");
    setError("");
    setProgress("");
    setResults([]);
    setDiscussStarted(false);
    setDiscussing(false);
    setMessages([]);
    setDiscussProgress("");
    setRevisedText("");
    setOriginalForDiff("");
    setLibrarianTurns(2);
    setWordsmithTurns(2);
    setPage(0);
  };

  const handleEvaluate = async () => {
    setError("");
    if (!topic.trim() || !text.trim()) {
      setError("주제와 글을 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    setResults([]);
    setProgress("평가단을 소집하는 중...");

    // 이전 회의·수정본 초기화 (다시 평가받으면 처음부터)
    setDiscussStarted(false);
    setDiscussing(false);
    setMessages([]);
    setDiscussProgress("");
    setRevisedText("");
    setOriginalForDiff("");
    setPage(0);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, text }),
      });

      if (!res.ok && res.headers.get("Content-Type")?.includes("application/json")) {
        const data = await res.json();
        setError(data.error || "평가에 실패했습니다.");
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "progress") {
            setProgress(event.message);
          } else if (event.type === "evaluation") {
            setResults((prev) => [...prev, event.result]);
          } else if (event.type === "complete") {
            setLoading(false);
          } else if (event.type === "error") {
            setError(event.message);
            setLoading(false);
          }
        }
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const handleDiscuss = async () => {
    setDiscussStarted(true);
    setDiscussing(true);
    setMessages([]);
    setOriginalForDiff(text); // 비교 기준 스냅샷
    setDiscussProgress("평가단을 회의실로 모으는 중...");

    try {
      const res = await fetch("/api/evaluate/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, librarianTurns, wordsmithTurns }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "progress") {
            setDiscussProgress(event.message);
          } else if (event.type === "message") {
            setMessages((prev) => [...prev, event.message]);
          } else if (event.type === "revision") {
            setRevisedText(event.revised);
          } else if (event.type === "complete") {
            setDiscussing(false);
            setDiscussProgress("");
          } else if (event.type === "error") {
            setDiscussProgress(event.message);
            setDiscussing(false);
          }
        }
      }
    } catch {
      setDiscussProgress("논의 진행에 실패했습니다.");
      setDiscussing(false);
    }
  };

  const byId = (id: string) => results.find((r) => r.evaluatorId === id);
  const allDone = results.length === EVALUATORS.length;

  // 글자수 (코드포인트 기준이라 이모지도 1자로 정확히 셈)
  const charsWithSpace = Array.from(text).length;
  const charsNoSpace = Array.from(text.replace(/\s/g, "")).length;

  // 넘겨 볼 수 있는 페이지 목록 (평가자 3 + 회의 + 바뀐 곳)
  const pages = [
    ...EVALUATORS.map((ev) => ({ key: ev.id, emoji: ev.emoji })),
    { key: "discuss", emoji: "💬" },
    { key: "diff", emoji: "🔍" },
  ];
  // 회의는 평가 3개가 다 나온 뒤에만, 비교는 수정본이 나온 뒤에만 열림
  const pageEnabled = (key: string) => {
    if (key === "discuss") return allDone;
    if (key === "diff") return !!revisedText && !!originalForDiff;
    return true;
  };
  const cur = Math.min(page, pages.length - 1);
  const curKey = pages[cur].key;

  const PAGE_LABEL: Record<string, string> = {
    chief: "🎓 평가원",
    librarian: "📚 인간 도서관",
    wordsmith: "✍️ 글조합 천재",
    discuss: "💬 회의 & 수정본",
    diff: "🔍 바뀐 곳 (내 글 → 수정본)",
  };

  // 깃허브 커밋 디프처럼: 삭제는 빨강, 추가는 초록
  const diffParts = useMemo(
    () => (revisedText && originalForDiff ? diffWords(originalForDiff, revisedText) : []),
    [originalForDiff, revisedText]
  );
  const enabledIdx = pages.map((_, i) => i).filter((i) => pageEnabled(pages[i].key));
  const prevIdx = [...enabledIdx].reverse().find((i) => i < cur);
  const nextIdx = enabledIdx.find((i) => i > cur);

  return (
    <div className="tp-assemble">
      {/* ── 좌측: 주제 + 글 (높이 채움) ── */}
      <div className="tp-col">
        {/* 파일 업로드 → 주제/글 자동 채우기 */}
        <label className={parsing ? "tp-upload tp-upload-busy" : "tp-upload"}>
          <input
            type="file"
            accept=".txt,.docx,.hwp,.hwpx"
            onChange={handleFile}
            disabled={parsing}
            hidden
          />
          {parsing ? "📄 파일을 읽는 중..." : "📎 파일 불러오기 (.txt / .docx / .hwp)"}
        </label>

        <label className="tp-field">
          <span className="tp-label">주제</span>
          <input
            className="tp-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 군중심리의 이해"
          />
        </label>

        <label className="tp-field tp-field-grow">
          <span className="tp-label">글</span>
          <textarea
            className="tp-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="평가받을 글을 붙여넣으세요."
          />
        </label>

        {/* 글자수 (메모장처럼) */}
        <p className="tp-charcount">
          공백 포함 <strong>{charsWithSpace.toLocaleString("ko-KR")}</strong>자 · 공백 제외{" "}
          <strong>{charsNoSpace.toLocaleString("ko-KR")}</strong>자
        </p>

        {error && <p className="tp-error">{error}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="tp-btn" onClick={handleEvaluate} disabled={loading} style={{ flex: 1 }}>
            {loading ? progress : "🧑‍⚖️ 평가 받기"}
          </button>
          {(results.length > 0 || discussStarted) && (
            <button
              className="tp-btn-outline"
              onClick={handleReset}
              disabled={loading || discussing}
              title="전부 비우고 처음부터"
              style={{ marginTop: 4 }}
            >
              🧹 초기화
            </button>
          )}
        </div>

        {/* 점수판 */}
        <div className="tp-scoreboard">
          <div className="tp-scoreboard-head">🏅 점수판</div>
          {EVALUATORS.map((ev, i) => {
            const r = byId(ev.id);
            return (
              <button
                key={ev.id}
                type="button"
                className="tp-score-row"
                aria-current={cur === i}
                onClick={() => setPage(i)}
              >
                <span className="tp-score-emoji">{ev.emoji}</span>
                <span className="tp-score-name">
                  {ev.name} <span className="tp-score-tag">· {ev.scoreLabel}</span>
                </span>
                <span className={r ? "tp-score-val" : "tp-score-val tp-score-val-empty"}>
                  {r ? r.score : "—"}
                  <span className="tp-score-max"> / {ev.maxScore}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 우측: 페이지로 넘겨 보기 ── */}
      <div className="tp-col tp-col-paged">
        <p className="tp-page-name">{PAGE_LABEL[curKey]}</p>

        <div className="tp-page-view">
          {/* 평가자 한 명 */}
          {EVALUATORS.some((e) => e.id === curKey) &&
            (() => {
              const ev = EVALUATORS.find((e) => e.id === curKey)!;
              const r = byId(ev.id);
              return (
                <div className={r ? "tp-judge tp-judge-done" : "tp-judge"}>
                  <div className="tp-judge-top">
                    <span className="tp-judge-face">{ev.emoji}</span>
                    <span className="tp-judge-id">
                      <span className="tp-judge-name">{ev.name}</span>
                      <span className="tp-judge-role">{ev.role}</span>
                    </span>
                    {r ? (
                      <span className="tp-judge-score">
                        {r.scoreLabel} {r.score}/{r.maxScore}
                      </span>
                    ) : (
                      <span className="tp-judge-wait">{loading ? "평가 중" : "대기 중"}</span>
                    )}
                  </div>

                  {r ? (
                    <>
                      <p className="tp-judge-body">{r.comment}</p>
                      {r.sources && r.sources.length > 0 && <SourceList sources={r.sources} />}
                    </>
                  ) : loading ? (
                    <div className="tp-judge-typing">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <p className="tp-judge-pending">글을 입력하고 평가를 받아보세요.</p>
                  )}
                </div>
              );
            })()}

          {/* 회의: 설정 → 채팅 */}
          {curKey === "discuss" &&
            (!discussStarted ? (
              <div className="tp-sub">
                <p className="tp-sub-title">💬 평가단에게 더 논의받기</p>
                <p className="tp-sub-desc">
                  평가단이 단톡방에서 토론하며 구체적인 수정 방향을 제안해요.
                </p>

                <p className="tp-col-title" style={{ margin: "0 0 8px" }}>📚 인간 도서관 발언</p>
                <div className="tp-choices" style={{ marginBottom: 14 }}>
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="tp-chip"
                      aria-pressed={librarianTurns === n}
                      onClick={() => setLibrarianTurns(n)}
                    >
                      {n}번
                    </button>
                  ))}
                </div>

                <p className="tp-col-title" style={{ margin: "0 0 8px" }}>✍️ 글조합 천재 발언</p>
                <div className="tp-choices" style={{ marginBottom: 16 }}>
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="tp-chip"
                      aria-pressed={wordsmithTurns === n}
                      onClick={() => setWordsmithTurns(n)}
                    >
                      {n}번
                    </button>
                  ))}
                </div>

                <button className="tp-btn" onClick={handleDiscuss} style={{ width: "100%" }}>
                  논의 시작
                </button>
              </div>
            ) : (
              <div className="tp-meeting">
                {/* 좌: 폰 채팅 (넓고 길게) */}
                <div className="tp-phone tp-phone-fill">
                  <div className="tp-phone-bar">
                    <div className="tp-phone-notch" />
                    <div className="tp-phone-title">💬 평가단 회의</div>
                    <div className="tp-phone-sub">평가원 · 인간 도서관 · 글조합 천재</div>
                  </div>

                  <div className="tp-chat">
                    <div className="tp-chat-day">회의 시작</div>

                    {messages.map((m, i) => {
                      const info = SPEAKER[m.speakerId] ?? SPEAKER.chief;

                      if (info.side === "center") {
                        return (
                          <div key={i} className="tp-msg-notice">
                            <p className="tp-notice-who">{info.emoji} {m.speakerName}</p>
                            <p className="tp-notice-text">{m.message}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={i} className={`tp-msg tp-msg-${info.side}`}>
                          <div className="tp-chat-avatar">{info.emoji}</div>
                          <div className="tp-msg-col">
                            <span className="tp-msg-who">{m.speakerName}</span>
                            <div className="tp-chat-bubble">{m.message}</div>
                          </div>
                        </div>
                      );
                    })}

                    {discussing && (
                      <div className="tp-msg tp-msg-left">
                        <div className="tp-chat-avatar">💬</div>
                        <div className="tp-msg-col">
                          <div className="tp-chat-bubble tp-typing">
                            <span /><span /><span />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* 우: 실제 수정본 */}
                <div className="tp-meeting-side">
                  <div className="tp-meeting-side-head">
                    <span className="tp-meeting-side-title">✨ 수정본</span>
                    {revisedText && (
                      <button
                        className="tp-btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(revisedText);
                          alert("수정본이 복사되었습니다.");
                        }}
                      >
                        📋 복사
                      </button>
                    )}
                  </div>
                  <div className="tp-meeting-side-body">
                    {revisedText ? (
                      <div className="tp-revision-plain">{revisedText}</div>
                    ) : (
                      <div className="tp-meeting-empty">
                        {discussing
                          ? "회의가 끝나면\n수정된 글이 여기에 나타나요."
                          : "아직 수정본이 없어요."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          {/* 바뀐 곳: 내 글 | 수정본 (1:1) */}
          {curKey === "diff" && revisedText && (
            <div className="tp-diff">
              <div className="tp-diff-pane">
                <div className="tp-diff-head tp-diff-head-del">📝 내 글 <span>지워진 부분</span></div>
                <div className="tp-diff-body">
                  {diffParts
                    .filter((p) => !p.added)
                    .map((p, i) =>
                      p.removed ? (
                        <del key={i} className="tp-diff-del">{p.value}</del>
                      ) : (
                        <span key={i}>{p.value}</span>
                      )
                    )}
                </div>
              </div>

              <div className="tp-diff-pane">
                <div className="tp-diff-head tp-diff-head-add">✨ 수정본 <span>더해진 부분</span></div>
                <div className="tp-diff-body">
                  {diffParts
                    .filter((p) => !p.removed)
                    .map((p, i) =>
                      p.added ? (
                        <ins key={i} className="tp-diff-add">{p.value}</ins>
                      ) : (
                        <span key={i}>{p.value}</span>
                      )
                    )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 페이지네이션 */}
        <div className="tp-pager">
          <button
            type="button"
            className="tp-pager-arrow"
            onClick={() => prevIdx !== undefined && setPage(prevIdx)}
            disabled={prevIdx === undefined}
            aria-label="이전"
          >
            ‹
          </button>

          <div className="tp-pager-dots">
            {pages.map((p, i) => (
              <button
                key={p.key}
                type="button"
                className="tp-pager-dot"
                aria-current={i === cur}
                disabled={!pageEnabled(p.key)}
                onClick={() => setPage(i)}
                title={PAGE_LABEL[p.key]}
              >
                {p.emoji}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="tp-pager-arrow"
            onClick={() => nextIdx !== undefined && setPage(nextIdx)}
            disabled={nextIdx === undefined}
            aria-label="다음"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
