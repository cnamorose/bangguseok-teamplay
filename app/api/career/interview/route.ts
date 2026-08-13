import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { INTERVIEWERS } from "@/lib/agents/interview/interviewers";
import { askNext, Turn } from "@/lib/agents/interview/ask";
import { buildContext, logInterviewUsage } from "@/lib/agents/interview/context";

export const maxDuration = 30;

const START_LIMIT = 10;
const START_WINDOW_MS = 10 * 60 * 1000;

const MAX_TURNS = 10;

/** 면접을 시작할 때 필요한 것 — 지원 건 목록과 면접관 명단 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const [applications, recent] = await Promise.all([
    prisma.application.findMany({
      where: { userId: user.id },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        role: true,
        company: { select: { name: true } },
        _count: { select: { essays: true } },
      },
    }),
    prisma.interview.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        maxTurns: true,
        application: { select: { role: true, company: { select: { name: true } } } },
      },
    }),
  ]);

  return NextResponse.json({ applications, recent }, { status: 200 });
}

/** 면접 시작 — 첫 질문까지 만들어 준다 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rl = rateLimit(`interview:${user.id}`, START_LIMIT, START_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const body = await req.json();
    const applicationId = body.applicationId ? String(body.applicationId) : null;
    const ids: string[] = Array.isArray(body.interviewerIds)
      ? body.interviewerIds.filter((id: unknown) =>
          INTERVIEWERS.some((i) => i.id === id)
        )
      : [];
    const maxTurns = Math.min(Math.max(Number(body.maxTurns) || 8, 1), MAX_TURNS);

    if (ids.length === 0) {
      return NextResponse.json({ error: "면접관을 한 명 이상 골라주세요." }, { status: 400 });
    }

    if (applicationId) {
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { userId: true },
      });
      if (!app || app.userId !== user.id) {
        return NextResponse.json({ error: "지원 건을 찾을 수 없습니다." }, { status: 404 });
      }
    }

    const interview = await prisma.interview.create({
      data: { userId: user.id, applicationId, interviewerIds: ids, maxTurns, turns: [] },
    });

    // 첫 질문
    const ctx = await buildContext(interview);
    const { result, usage } = await askNext(ctx);
    await logInterviewUsage(user.id, `${ctx.companyName} · ${ctx.role} 면접`, "ask", usage);

    const firstTurn: Turn = {
      role: "interviewer",
      speaker: result.interviewerId,
      content: result.question,
    };

    await prisma.interview.update({
      where: { id: interview.id },
      data: { turns: [firstTurn as unknown as Prisma.InputJsonValue] },
    });

    return NextResponse.json(
      {
        interview: {
          id: interview.id,
          maxTurns,
          interviewerIds: ids,
          companyName: ctx.companyName,
          role: ctx.role,
          turns: [firstTurn],
          remaining: ctx.remaining,
          status: "running",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("면접 시작 에러:", error);
    return NextResponse.json({ error: "면접을 시작하지 못했습니다." }, { status: 500 });
  }
}
