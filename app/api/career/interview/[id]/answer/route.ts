import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { askNext, Turn } from "@/lib/agents/interview/ask";
import { buildContext, logInterviewUsage } from "@/lib/agents/interview/context";
import { speakSeconds } from "@/lib/agents/interview/interviewers";
import { checkAnswer } from "@/lib/agents/interview/answer-check";

export const maxDuration = 30;

const ANSWER_LIMIT = 60;
const ANSWER_WINDOW_MS = 10 * 60 * 1000;
const MAX_ANSWER_LEN = 3000;

/**
 * 답변 제출 → 다음 질문.
 * 제출한 답변은 고칠 수 없다(실전 감각). 남은 횟수가 0이면 면접이 끝난다.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rl = rateLimit(`interview-answer:${user.id}`, ANSWER_LIMIT, ANSWER_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const { id } = await params;
    const interview = await prisma.interview.findUnique({ where: { id } });

    if (!interview || interview.userId !== user.id) {
      return NextResponse.json({ error: "면접을 찾을 수 없습니다." }, { status: 404 });
    }
    if (interview.status !== "running") {
      return NextResponse.json({ error: "이미 끝난 면접이에요." }, { status: 400 });
    }

    const body = await req.json();
    const answer = String(body.answer ?? "").trim().slice(0, MAX_ANSWER_LEN);
    if (!answer) {
      return NextResponse.json({ error: "답변을 입력해주세요." }, { status: 400 });
    }

    const elapsed = Number(body.seconds) > 0 ? Math.round(Number(body.seconds)) : undefined;

    // 답변인지 코드로 먼저 가린다 (LLM에 넘기면 무의미한 입력도 좋게 해석한다)
    const check = checkAnswer(answer);

    const answerTurn: Turn = {
      role: "candidate",
      content: answer,
      // 실제로 걸린 시간이 없으면 말했을 때의 길이로 대신 잰다
      seconds: elapsed ?? speakSeconds(answer),
      over: (elapsed ?? 0) > 60 || speakSeconds(answer) > 60,
      ...(check.ok ? {} : { invalid: check.reason }),
    };

    const turns = [...(interview.turns as unknown as Turn[]), answerTurn];

    // 답변 저장 (여기서 한 번 끊어야 다음 질문이 실패해도 답변이 남는다)
    await prisma.interview.update({
      where: { id },
      data: { turns: turns as unknown as Prisma.InputJsonValue[] },
    });

    const ctx = await buildContext({ ...interview, turns: turns as unknown as Prisma.JsonValue[] });

    // 예산이 다 떨어졌으면 여기서 끝
    if (ctx.remaining <= 0) {
      await prisma.interview.update({ where: { id }, data: { status: "done" } });
      return NextResponse.json({ turns, remaining: 0, status: "done" }, { status: 200 });
    }

    const { result, usage } = await askNext(ctx);
    await logInterviewUsage(user.id, `${ctx.companyName} · ${ctx.role} 면접`, "ask", usage);

    const questionTurn: Turn = {
      role: "interviewer",
      speaker: result.interviewerId,
      content: result.question,
    };
    const next = [...turns, questionTurn];

    await prisma.interview.update({
      where: { id },
      data: { turns: next as unknown as Prisma.InputJsonValue[] },
    });

    return NextResponse.json(
      { turns: next, remaining: ctx.remaining, status: "running", followUp: result.followUp },
      { status: 200 }
    );
  } catch (error) {
    console.error("면접 답변 에러:", error);
    return NextResponse.json({ error: "다음 질문을 만들지 못했습니다." }, { status: 500 });
  }
}
