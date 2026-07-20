"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { diffWords } from "diff";
import { parseSource } from "@/lib/parse-source";
import { extractArticleText } from "@/lib/result-text";

interface ScoreBreakdown {
  label: string;
  score: number;
  maxScore: number;
}

interface EvalResult {
  evaluatorId: string;
  evaluatorName: string;
  scoreLabel: string;
  score: number;
  maxScore: number;
  comment: string;
  breakdown?: ScoreBreakdown[];
  sources?: string[];
}

// 세부 항목 점수를 막대로 보여준다 (평가 카드 / 클립보드 공용 느낌)
function ScoreBreakdownList({ breakdown }: { breakdown: ScoreBreakdown[] }) {
  return (
    <div className="tp-rubric">
      {breakdown.map((b, i) => {
        const pct = b.maxScore > 0 ? Math.round((b.score / b.maxScore) * 100) : 0;
        return (
          <div key={i} className="tp-rubric-row">
            <span className="tp-rubric-label">{b.label}</span>
            <span className="tp-rubric-bar">
              <span className="tp-rubric-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="tp-rubric-score">
              {b.score}
              <span className="tp-rubric-max">/{b.maxScore}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
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
          const { title, url } = parseSource(s);
          return (
            <li key={i}>
              {url ? (
                <a className="tp-entry-link" href={url} target="_blank" rel="noopener noreferrer">
                  {title}
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

// 책장에서 책을 꺼내오는 팝업. 한 페이지에 5권씩, 페이지를 넘길 때마다 서버에서 불러온다.
interface PickerItem {
  id: string;
  topic: string;
  createdAt: string;
  assembly: { name: string };
}

const PICKER_PAGE_SIZE = 5;

// 평가용으로 받는 파일 확장자 (input accept + 드롭 검증 공용)
const ACCEPT_EXT = [".txt", ".docx", ".hwp", ".hwpx"];

function BookshelfPicker({
  onPick,
  onClose,
}: {
  onPick: (topic: string, text: string) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pickingId, setPickingId] = useState<string | null>(null);

  // 페이지가 바뀔 때마다 그 페이지만 불러온다 (전부 한 번에 X)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/results?page=${page}&pageSize=${PICKER_PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setItems(data.results);
          setTotalPages(Math.max(1, data.totalPages ?? 1));
        }
      })
      .catch(() => !cancelled && setError("책장을 불러오지 못했습니다."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page]);

  // 책을 고르면 그 결과의 전체 데이터를 받아 글 본문을 추출한다.
  const pick = async (item: PickerItem) => {
    setPickingId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/result/${item.id}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "책을 불러오지 못했습니다.");
        return;
      }
      const text = extractArticleText(data.result?.resultData);
      onPick(item.topic, text);
    } catch {
      setError("책을 불러오지 못했습니다.");
    } finally {
      setPickingId(null);
    }
  };

  return (
    <div className="tp-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tp-modal-head">
          <span className="tp-modal-title">📚 책장에서 꺼내오기</span>
          <button type="button" className="tp-modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="tp-modal-body">
          {error && <p className="tp-note tp-note-error">{error}</p>}

          {/* 처음 열 때(아직 아무것도 없을 때)만 안내 문구 */}
          {!error && items.length === 0 && loading && (
            <p className="tp-note">책장을 펼치는 중...</p>
          )}
          {!error && items.length === 0 && !loading && (
            <p className="tp-note">아직 책장에 꽂힌 책이 없어요.</p>
          )}

          {/* 페이지를 넘기는 중에도 목록은 유지하고, 살짝 흐리게만 (모달은 고정) */}
          {!error && items.length > 0 && (
            <div className={loading ? "tp-picker-list tp-picker-list-busy" : "tp-picker-list"}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="tp-picker-row"
                  onClick={() => pick(item)}
                  disabled={pickingId !== null || loading}
                >
                  <span className="tp-picker-row-main">
                    <span className="tp-picker-row-title">{item.topic}</span>
                    <span className="tp-picker-row-meta">
                      {item.assembly.name} · {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </span>
                  <span className="tp-picker-row-arrow">
                    {pickingId === item.id ? "…" : "꺼내오기 →"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="tp-modal-foot">
          <button
            type="button"
            className="tp-pager-arrow"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
            aria-label="이전"
          >
            ‹
          </button>
          <span className="tp-picker-page">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="tp-pager-arrow"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || page >= totalPages}
            aria-label="다음"
          >
            ›
          </button>
        </div>
      </div>
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
  const [dragActive, setDragActive] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 자동 저장: 평가가 끝나면 원본+결과를 저장하고, 논의 수정본이 나오면 같은 레코드에 덧붙인다.
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // 논의 관련
  const [librarianTurns, setLibrarianTurns] = useState(2);
  const [wordsmithTurns, setWordsmithTurns] = useState(2);
  // 사용자가 수정본에 반영하고 싶은 의견 (선택)
  const [userOpinion, setUserOpinion] = useState("");
  const [discussing, setDiscussing] = useState(false);
  const [discussStarted, setDiscussStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [discussProgress, setDiscussProgress] = useState("");
  const [revisedText, setRevisedText] = useState("");
  // 논의 시작 시점의 원본 (비교 기준 — 이후 입력칸을 고쳐도 디프가 안 흔들리게)
  const [originalForDiff, setOriginalForDiff] = useState("");

  // 우측 페이지 인덱스
  const [page, setPage] = useState(0);

  // 결과 페이지에서 "평가받기"로 넘어온 경우: 주제/글을 자동으로 채운다.
  useEffect(() => {
    const raw = sessionStorage.getItem("evaluate:prefill");
    if (!raw) return;
    sessionStorage.removeItem("evaluate:prefill");
    try {
      const { topic: t, text: x } = JSON.parse(raw);
      if (t) setTopic(t);
      if (x) setText(x);
    } catch {
      /* 형식이 깨졌으면 무시 */
    }
  }, []);

  // 책장 팝업에서 책을 골랐을 때
  const handlePickFromShelf = (t: string, x: string) => {
    setTopic(t);
    setText(x);
    setError("");
    setPickerOpen(false);
  };

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

  // 파일 하나를 파싱해서 주제/글 채우기 (업로드/드롭 공용)
  const processFile = async (file: File) => {
    // 확장자 확인 (드롭으로 아무 파일이나 들어오는 걸 막음)
    const ok = ACCEPT_EXT.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setError(`지원하지 않는 파일이에요. (${ACCEPT_EXT.join(" / ")})`);
      return;
    }

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

  // 파일 선택(클릭) → 파싱
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 동작하게 초기화
    if (file) processFile(file);
  };

  // 드래그 앤 드롭
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!parsing) setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (parsing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
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
    setUserOpinion("");
    setPage(0);
    setEvaluationId(null);
    setSaveState("idle");
  };

  // 평가 완료 시 자동 저장 (원본 + 결과). 저장된 레코드 id를 기억한다.
  const autoSaveEvaluation = async (evalResults: EvalResult[]) => {
    if (!evalResults || evalResults.length === 0) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/evaluate/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, text, results: evalResults }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setSaveState("error");
        return;
      }
      setEvaluationId(data.id);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  // 논의 수정본이 나오면 같은 레코드에 덧붙여 저장 (없으면 통째로 새로 저장)
  const saveRevision = async (revised: string, evalResults: EvalResult[]) => {
    if (!revised.trim()) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/evaluate/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: evaluationId ?? undefined,
          topic,
          text,
          results: evalResults,
          revised,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setSaveState("error");
        return;
      }
      setEvaluationId(data.id);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
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
    // 새로 평가받으면 저장 상태 초기화 (새 레코드가 생성됨)
    setEvaluationId(null);
    setSaveState("idle");

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
            // 평가 전체가 끝나면 자동 저장 (complete 이벤트에 전체 결과가 담겨 옴)
            if (Array.isArray(event.evaluations)) autoSaveEvaluation(event.evaluations);
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

    // 이 논의에서 나온 수정본을 스트림 도중 담아뒀다가, 끝나면 저장에 쓴다.
    let revisedFromDiscuss = "";

    try {
      const res = await fetch("/api/evaluate/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, librarianTurns, wordsmithTurns, userOpinion }),
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
            revisedFromDiscuss = event.revised;
            setRevisedText(event.revised);
          } else if (event.type === "complete") {
            setDiscussing(false);
            setDiscussProgress("");
            // 수정본이 나왔으면 저장된 평가 레코드에 덧붙인다
            if (revisedFromDiscuss.trim()) saveRevision(revisedFromDiscuss, results);
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
        {/* 책장에서 기존 결과물 꺼내오기 */}
        <button type="button" className="tp-upload" onClick={() => setPickerOpen(true)}>
          📚 책장에서 꺼내오기
        </button>

        {/* 파일 업로드(클릭) + 드래그 앤 드롭 → 주제/글 자동 채우기 */}
        <label
          className={
            "tp-upload" +
            (parsing ? " tp-upload-busy" : "") +
            (dragActive ? " tp-upload-drag" : "")
          }
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={ACCEPT_EXT.join(",")}
            onChange={handleFile}
            disabled={parsing}
            hidden
          />
          {parsing
            ? "📄 파일을 읽는 중..."
            : dragActive
            ? "📥 여기에 놓으세요"
            : "📎 파일 불러오기 · 드래그해서 놓기 (.txt / .docx / .hwp)"}
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

        {/* 자동 저장 상태 (평가가 끝나면 책장에 자동 저장됨) */}
        {allDone && saveState !== "idle" && (
          <p className={saveState === "error" ? "tp-save-note tp-save-note-error" : "tp-save-note"}>
            {saveState === "saving"
              ? "저장 중..."
              : saveState === "saved"
              ? "✅ 책장에 자동 저장됨 (수정본이 나오면 함께 갱신돼요)"
              : "⚠️ 자동 저장에 실패했어요. 다시 평가받거나 논의하면 재시도해요."}
          </p>
        )}

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
                      {r.breakdown && r.breakdown.length > 0 && (
                        <ScoreBreakdownList breakdown={r.breakdown} />
                      )}
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

                <p className="tp-col-title" style={{ margin: "0 0 8px" }}>
                  🙋 내 의견 <span style={{ fontWeight: 400, opacity: 0.6 }}>(선택 · 수정본에 반영)</span>
                </p>
                <textarea
                  className="tp-textarea"
                  value={userOpinion}
                  onChange={(e) => setUserOpinion(e.target.value)}
                  placeholder="수정본에 꼭 반영했으면 하는 점을 적어주세요. 평가단 지적보다 우선 반영돼요. (예: 도입부는 그대로 두고, 결론만 더 강하게)"
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box", marginBottom: 16, minHeight: 84 }}
                />

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

      {pickerOpen && (
        <BookshelfPicker onPick={handlePickFromShelf} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
