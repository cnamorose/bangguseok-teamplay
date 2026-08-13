"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INTERVIEWERS, getInterviewer, speakSeconds } from "@/lib/agents/interview/interviewers";
import { checkAnswer } from "@/lib/agents/interview/answer-check";

interface Turn {
  role: "interviewer" | "candidate";
  speaker?: string;
  content: string;
  seconds?: number;
  over?: boolean;
  /** 답변으로 볼 수 없는 입력 (자판을 두드린 경우 등) */
  invalid?: string;
}

interface AppOpt {
  id: string;
  role: string;
  company: { name: string };
  _count: { essays: number };
}

interface Feedback {
  perQuestion: { question: string; good: string; weak: string; better: string }[];
  strengths: string[];
  habits: string[];
  todo: string[];
  timing: string;
  noAnswer?: boolean;
}

const LIMIT_SEC = 60;

export default function InterviewRoom() {
  const router = useRouter();

  const [apps, setApps] = useState<AppOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 설정
  const [appId, setAppId] = useState("");
  const [picked, setPicked] = useState<string[]>(["pressure", "tech"]);
  const [maxTurns, setMaxTurns] = useState(6);

  // 진행
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [meta, setMeta] = useState({ companyName: "", role: "" });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [answer, setAnswer] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // 답변 타이머 (질문이 바뀔 때마다 0부터)
  const [elapsed, setElapsed] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/career/interview")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setApps(d.applications);
          if (d.applications.length > 0) setAppId(d.applications[0].id);
        }
      })
      .catch(() => setError("불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  // 면접이 도는 동안만 초를 센다
  useEffect(() => {
    if (!interviewId || done || waiting) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [interviewId, done, waiting, turns.length]);

  // 새 질문이 오면 타이머 리셋 + 아래로 스크롤
  useEffect(() => {
    setElapsed(0);
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const start = async () => {
    setError("");
    setWaiting(true);
    try {
      const res = await fetch("/api/career/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: appId || null, interviewerIds: picked, maxTurns }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "면접을 시작하지 못했습니다.");
        return;
      }
      setInterviewId(d.interview.id);
      setMeta({ companyName: d.interview.companyName, role: d.interview.role });
      setTurns(d.interview.turns);
      setRemaining(d.interview.remaining);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setWaiting(false);
    }
  };

  const submit = async () => {
    if (!answer.trim() || !interviewId) return;
    const seconds = elapsed;
    // 낙관적으로 먼저 붙여 둔다 (제출한 답변은 어차피 못 고친다)
    setTurns((prev) => [
      ...prev,
      { role: "candidate", content: answer.trim(), seconds, over: seconds > LIMIT_SEC },
    ]);
    setAnswer("");
    setWaiting(true);

    try {
      const res = await fetch(`/api/career/interview/${interviewId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answer.trim(), seconds }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "다음 질문을 만들지 못했습니다.");
        return;
      }
      setTurns(d.turns);
      setRemaining(d.remaining);
      if (d.status === "done") setDone(true);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setWaiting(false);
    }
  };

  const finish = async () => {
    if (!interviewId) return;
    setWaiting(true);
    try {
      const res = await fetch(`/api/career/interview/${interviewId}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "총평을 만들지 못했습니다.");
        return;
      }
      setFeedback(d.feedback);
      setDone(true);
    } finally {
      setWaiting(false);
    }
  };

  if (loading) return <p className="tp-note">불러오는 중...</p>;

  /* ── 설정 ── */
  if (!interviewId) {
    return (
      <div className="tp-career-col">
        <div className="tp-panel">
          <p className="tp-col-title">🎤 누구와 면접을 볼까요?</p>

          <label className="tp-field">
            <span className="tp-label">
              지원 건 <span className="tp-optional">{apps.length === 0 && "(없어도 연습은 됩니다)"}</span>
            </span>
            {apps.length === 0 ? (
              <>
                <p className="tp-sub-desc" style={{ margin: 0 }}>
                  지원 건이 있으면 <strong>내가 낸 자소서를 읽고</strong> 꼬리질문을 합니다.
                </p>
                <button className="tp-btn-outline" onClick={() => router.push("/career/desk")}>
                  🗂️ 책상에서 지원 건 만들기
                </button>
              </>
            ) : (
              <>
                <select className="tp-input" value={appId} onChange={(e) => setAppId(e.target.value)}>
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.company.name} · {a.role}
                      {a._count.essays > 0 ? ` (자소서 ${a._count.essays}문항)` : ""}
                    </option>
                  ))}
                </select>
                <span className="tp-sub-desc" style={{ margin: 0 }}>
                  자소서에 쓴 문장을 그대로 인용해 되묻습니다.
                </span>
              </>
            )}
          </label>

          <div className="tp-field">
            <span className="tp-label">면접관 <span className="tp-optional">(2~3명이 적당해요)</span></span>
            <div className="tp-exp-pick">
              {INTERVIEWERS.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="tp-pick"
                  aria-pressed={picked.includes(i.id)}
                  onClick={() => toggle(i.id)}
                >
                  <strong>{i.emoji} {i.name}</strong>
                  <em>{i.role}</em>
                </button>
              ))}
            </div>
          </div>

          <label className="tp-field">
            <span className="tp-label">
              질문 수 <span className="tp-optional">· 꼬리질문 포함해서 {maxTurns}번 답합니다</span>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <span className="tp-sub-desc" style={{ margin: 0 }}>1 ~ 10개</span>
          </label>

          {error && <p className="tp-error">{error}</p>}

          <button className="tp-btn" onClick={start} disabled={picked.length === 0 || waiting}>
            {waiting ? "면접관을 부르는 중..." : "🎤 면접 시작"}
          </button>
          <p className="tp-sub-desc" style={{ margin: 0 }}>
            답변은 <strong>제출하면 고칠 수 없어요.</strong> 실제 면접처럼 한 번에 답해보세요.
          </p>
        </div>
      </div>
    );
  }

  /* ── 총평 ── */
  if (feedback) {
    return (
      <div className="tp-career-col">
        <div className="tp-panel">
          <p className="tp-col-title">🎤 {meta.companyName} · {meta.role} — 면접 총평</p>

          {feedback.noAnswer && (
            <div className="tp-gaps">
              <p className="tp-gap-q">답변다운 답변이 없어서 평가할 게 없어요.</p>
              <p className="tp-gap-why">
                질문에 한 문장이라도 실제로 답한 뒤에 다시 받아보세요.
              </p>
            </div>
          )}

          {feedback.timing && <p className="tp-connect">⏱ {feedback.timing}</p>}

          {feedback.strengths.length > 0 && (
            <div className="tp-sub tp-sub-tight">
              <p className="tp-sub-title">잘 지킨 것</p>
              <ul className="tp-check">
                {feedback.strengths.map((s, i) => <li key={i}>✓ {s}</li>)}
              </ul>
            </div>
          )}

          {feedback.habits.length > 0 && (
            <div className="tp-gaps">
              <p className="tp-sub-title">반복해서 나온 습관</p>
              {feedback.habits.map((h, i) => (
                <div className="tp-gap" key={i}><p className="tp-gap-q">{h}</p></div>
              ))}
            </div>
          )}

          {feedback.todo.length > 0 && (
            <div className="tp-sub tp-sub-tight">
              <p className="tp-sub-title">다음 면접 전에 준비할 것</p>
              <ul className="tp-check">
                {feedback.todo.map((t, i) => <li key={i}>· {t}</li>)}
              </ul>
            </div>
          )}
        </div>

        {feedback.perQuestion.map((q, i) => (
          <div className="tp-panel" key={i}>
            <div className="tp-q-head">
              <span className="tp-q-num">{i + 1}</span>
              <div className="tp-q-title"><strong>{q.question}</strong></div>
            </div>
            {q.good && <p className="tp-connect">👍 {q.good}</p>}
            {q.weak && <p className="tp-blk-body">{q.weak}</p>}
            {q.better && (
              <div className="tp-gaps">
                <p className="tp-sub-title">이렇게 답했다면</p>
                <div className="tp-essay-body">{q.better}</div>
              </div>
            )}
          </div>
        ))}

        <button className="tp-btn" onClick={() => location.reload()}>🎤 다시 연습하기</button>
      </div>
    );
  }

  /* ── 면접 진행 ── */
  const answered = turns.filter((t) => t.role === "candidate" && !t.invalid).length;
  const willSpeak = speakSeconds(answer);
  const over = elapsed > LIMIT_SEC;
  const valid = checkAnswer(answer);

  return (
    <div className="tp-career-col">
      <div className="tp-iv-top">
        <strong>{meta.companyName} · {meta.role}</strong>
        <span className="tp-iv-count">질문 {answered + (done ? 0 : 1)} / {maxTurns}</span>
        <span className={`tp-iv-timer${over ? " is-over" : ""}`}>
          ⏱ {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="tp-chat" ref={chatRef}>
        {turns.map((t, i) =>
          t.role === "interviewer" ? (
            <div className="tp-msg tp-msg-left" key={i}>
              <span className="tp-chat-avatar">{getInterviewer(t.speaker ?? "").emoji}</span>
              <div className="tp-msg-col">
                <span className="tp-msg-who">{getInterviewer(t.speaker ?? "").name}</span>
                <div className="tp-chat-bubble">{t.content}</div>
              </div>
            </div>
          ) : (
            <div className="tp-msg tp-msg-right" key={i}>
              <span className="tp-chat-avatar">🙋</span>
              <div className="tp-msg-col">
                <span className="tp-msg-who">
                  {t.invalid
                    ? `나 · ⚠ ${t.invalid}`
                    : `나 ${t.seconds ? `· ${t.seconds}초` : ""}${t.over ? " · 길었어요" : ""}`}
                </span>
                <div className={`tp-chat-bubble${t.invalid ? " is-invalid" : ""}`}>{t.content}</div>
              </div>
            </div>
          )
        )}
        {waiting && (
          <div className="tp-msg tp-msg-left">
            <span className="tp-chat-avatar">💭</span>
            <div className="tp-judge-typing"><span /><span /><span /></div>
          </div>
        )}
      </div>

      {error && <p className="tp-error">{error}</p>}

      {done ? (
        <button className="tp-btn" onClick={finish} disabled={waiting}>
          {waiting ? "총평을 만드는 중..." : "📋 총평 받기"}
        </button>
      ) : (
        <div className="tp-panel">
          <textarea
            className="tp-textarea"
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="답변을 입력하세요. 제출하면 고칠 수 없어요."
            disabled={waiting}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <div className="tp-iv-foot">
            <span className={`tp-sub-desc${willSpeak > LIMIT_SEC || !valid.ok ? " is-over" : ""}`} style={{ margin: 0 }}>
              {answer.trim() && !valid.ok
                ? `⚠ ${valid.reason} — 이대로 내면 답변으로 안 쳐요`
                : `말하면 약 ${willSpeak}초${willSpeak > LIMIT_SEC ? " · 1분을 넘겨요" : ""}`}
            </span>
            <button className="tp-btn" onClick={submit} disabled={!answer.trim() || waiting}>
              제출
            </button>
          </div>
          <button className="tp-btn-outline" onClick={finish} disabled={waiting}>
            그만하고 총평 받기
          </button>
        </div>
      )}
    </div>
  );
}
