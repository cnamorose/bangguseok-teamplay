import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeFeedback } from "@/lib/agents/interview/feedback";
import { Turn } from "@/lib/agents/interview/ask";
import { logInterviewUsage } from "@/lib/agents/interview/context";

export const maxDuration = 60;

async function load(id: string, userId: string) {
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { application: { include: { company: { select: { name: true } } } } },
  });
  if (!interview) return { error: "면접을 찾을 수 없습니다.", status: 404 as const };
  if (interview.userId !== userId) return { error: "접근 권한이 없습니다.", status: 403 as const };
  return { interview };
}

/** 면접 하나 (이어서 보기 · 결과 보기) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const found = await load(id, user.id);
  if ("error" in found) {
    return NextResponse.json({ error: found.error }, { status: found.status });
  }

  return NextResponse.json({ interview: found.interview }, { status: 200 });
}

/** 면접 끝내고 총평 받기 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const found = await load(id, user.id);
    if ("error" in found) {
      return NextResponse.json({ error: found.error }, { status: found.status });
    }

    const { interview } = found;
    const turns = interview.turns as unknown as Turn[];

    if (turns.filter((t) => t.role === "candidate").length === 0) {
      return NextResponse.json({ error: "아직 답변한 질문이 없어요." }, { status: 400 });
    }

    // 이미 받아 둔 총평이 있으면 다시 만들지 않는다 (LLM을 아낀다)
    if (interview.feedback) {
      return NextResponse.json({ feedback: interview.feedback }, { status: 200 });
    }

    const companyName = interview.application?.company.name ?? "지원 회사";
    const role = interview.application?.role ?? "지원 직무";

    const { feedback, usage } = await makeFeedback(companyName, role, turns);
    await logInterviewUsage(user.id, `${companyName} · ${role} 면접 총평`, "feedback", usage);

    await prisma.interview.update({
      where: { id },
      data: {
        status: "done",
        feedback: feedback as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ feedback }, { status: 200 });
  } catch (error) {
    console.error("면접 총평 에러:", error);
    return NextResponse.json({ error: "총평을 만들지 못했습니다." }, { status: 500 });
  }
}
