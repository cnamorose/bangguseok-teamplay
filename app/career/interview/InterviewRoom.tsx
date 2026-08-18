"use client";

import Loading from "@/app/components/Loading";

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

  if (loading) return <Loading label="불러오는 중…" />;

  /* ── 설정 ── */
  if (!interviewId) {
    return (
      <>
        <header className="ui-head">
          <h1>면접 준비</h1>
          <p>면접관을 골라 앉히고, 실제처럼 한 번에 답해보세요.</p>
        </header>

        <div className="ui-panel ui-form">
          <div className="ui-field">
            <span>
              지원 건 <em>{apps.length === 0 && "(없어도 연습은 됩니다)"}</em>
            </span>
            {apps.length === 0 ? (
              <>
                <p className="ui-hint">
                  지원 건이 있으면 <strong>내가 낸 자소서를 읽고</strong> 꼬리질문을 합니다.
                </p>
                <div className="ui-actions">
                  <button
                    className="ui-btn ui-btn-ghost"
                    onClick={() => router.push("/career/desk")}
                  >
                    🗂️ 책상에서 지원 건 만들기
                  </button>
                </div>
              </>
            ) : (
              <>
                <select
                  className="ui-input"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.company.name} · {a.role}
                      {a._count.essays > 0 ? ` (자소서 ${a._count.essays}문항)` : ""}
                    </option>
                  ))}
                </select>
                <p className="ui-hint">자소서에 쓴 문장을 그대로 인용해 되묻습니다.</p>
              </>
            )}
          </div>

          <div className="ui-field">
            <span>
              면접관 <em>(2~3명이 적당해요)</em>
            </span>
            <div className="ui-picks">
              {INTERVIEWERS.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="ui-pick"
                  aria-pressed={picked.includes(i.id)}
                  onClick={() => toggle(i.id)}
                >
                  <strong>
                    {i.emoji} {i.name}
                  </strong>
                  <em>{i.role}</em>
                </button>
              ))}
            </div>
          </div>

          <label className="ui-field">
            <span>
              질문 수 <em>· 꼬리질문 포함해서 {maxTurns}번 답합니다 (1~10개)</em>
            </span>
            <input
              className="ui-range"
              type="range"
              min={1}
              max={10}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
            />
          </label>

          {error && <p className="ui-note is-err">{error}</p>}

          <div className="ui-actions is-end">
            <span className="ui-hint">
              답변은 <strong>제출하면 고칠 수 없어요.</strong>
            </span>
            <button className="ui-btn" onClick={start} disabled={picked.length === 0 || waiting}>
              {waiting ? "면접관을 부르는 중…" : "🎤 면접 시작"}
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ── 총평 ── */
  if (feedback) {
    return (
      <>
        <header className="ui-head is-row">
          <div>
            <h1>면접 총평</h1>
            <p>
              {meta.companyName} · {meta.role}
            </p>
          </div>
          <button className="ui-btn" onClick={() => location.reload()}>
            🎤 다시 연습하기
          </button>
        </header>

        <div className="ui-panel ui-form">
          {feedback.noAnswer && (
            <div className="ui-gaps">
              <p className="ui-gap-q">답변다운 답변이 없어서 평가할 게 없어요.</p>
              <p className="ui-gap-why">질문에 한 문장이라도 실제로 답한 뒤에 다시 받아보세요.</p>
            </div>
          )}

          {feedback.timing && <p className="ui-tip">⏱ {feedback.timing}</p>}

          {feedback.strengths.length > 0 && (
            <div className="ui-field">
              <span>잘 지킨 것</span>
              <ul className="ui-check">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="is-done">
                    ✓ {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.habits.length > 0 && (
            <div className="ui-gaps">
              <h3>반복해서 나온 습관</h3>
              {feedback.habits.map((h, i) => (
                <div className="ui-gap" key={i}>
                  <p className="ui-gap-q">{h}</p>
                </div>
              ))}
            </div>
          )}

          {feedback.todo.length > 0 && (
            <div className="ui-field">
              <span>다음 면접 전에 준비할 것</span>
              <ul className="ui-check">
                {feedback.todo.map((t, i) => (
                  <li key={i}>· {t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <section className="ui-sec">
          <div className="ui-sec-head">
            <h2>질문별로</h2>
            <p>{feedback.perQuestion.length}개</p>
          </div>

          <ol className="ui-steps">
            {feedback.perQuestion.map((q, i) => (
              <li className="ui-step" key={i}>
                <h3 className="ui-step-head">
                  <span className="ui-step-n">{i + 1}</span>
                  {q.question}
                </h3>

                <div className="ui-step-body ui-form">
                  {q.good && <p className="ui-tip">👍 {q.good}</p>}
                  {q.weak && <p className="ui-step-text">{q.weak}</p>}
                  {q.better && (
                    <div className="ui-gaps">
                      <h3>이렇게 답했다면</h3>
                      <p className="ui-step-text">{q.better}</p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </>
    );
  }

  /* ── 면접 진행 ── */
  const answered = turns.filter((t) => t.role === "candidate" && !t.invalid).length;
  const willSpeak = speakSeconds(answer);
  const over = elapsed > LIMIT_SEC;
  const valid = checkAnswer(answer);

  return (
    <>
      <header className="ui-head is-row">
        <div>
          <h1>
            {meta.companyName} · {meta.role}
          </h1>
          <p>
            질문 {answered + (done ? 0 : 1)} / {maxTurns}
          </p>
        </div>
        <span className={`ui-badge ${over ? "is-fail is-urgent" : "is-mute"}`}>
          ⏱ {String(Math.floor(elapsed / 60))}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      </header>

      <div className="ui-chat" ref={chatRef}>
        {turns.map((t, i) =>
          t.role === "interviewer" ? (
            <div className="ui-msg" key={i}>
              <span className="ui-msg-face">{getInterviewer(t.speaker ?? "").emoji}</span>
              <div className="ui-msg-col">
                <span className="ui-msg-who">{getInterviewer(t.speaker ?? "").name}</span>
                <div className="ui-bubble">{t.content}</div>
              </div>
            </div>
          ) : (
            <div className="ui-msg is-right" key={i}>
              <span className="ui-msg-face">🙋</span>
              <div className="ui-msg-col">
                <span className="ui-msg-who">
                  {t.invalid
                    ? `나 · ⚠ ${t.invalid}`
                    : `나 ${t.seconds ? `· ${t.seconds}초` : ""}${t.over ? " · 길었어요" : ""}`}
                </span>
                <div className={`ui-bubble${t.invalid ? " is-invalid" : ""}`}>{t.content}</div>
              </div>
            </div>
          )
        )}

        {waiting && (
          <div className="ui-msg">
            <span className="ui-msg-face">💭</span>
            <div className="ui-msg-col">
              <div className="ui-bubble">
                <span className="ui-typing">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="ui-note is-err">{error}</p>}

      {done ? (
        <div className="ui-actions is-end">
          <button className="ui-btn" onClick={finish} disabled={waiting}>
            {waiting ? "총평을 만드는 중…" : "📋 총평 받기"}
          </button>
        </div>
      ) : (
        <div className="ui-panel ui-form">
          <textarea
            className="ui-textarea"
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="답변을 입력하세요. 제출하면 고칠 수 없어요."
            disabled={waiting}
          />

          <div className="ui-actions">
            <span className={willSpeak > LIMIT_SEC || !valid.ok ? "ui-note is-err" : "ui-hint"}>
              {answer.trim() && !valid.ok
                ? `⚠ ${valid.reason} — 이대로 내면 답변으로 안 쳐요`
                : `말하면 약 ${willSpeak}초${willSpeak > LIMIT_SEC ? " · 1분을 넘겨요" : ""}`}
            </span>

            <button
              className="ui-btn ui-btn-ghost"
              style={{ marginLeft: "auto" }}
              onClick={finish}
              disabled={waiting}
            >
              그만하고 총평
            </button>
            <button className="ui-btn" onClick={submit} disabled={!answer.trim() || waiting}>
              제출
            </button>
          </div>
        </div>
      )}
    </>
  );
}
