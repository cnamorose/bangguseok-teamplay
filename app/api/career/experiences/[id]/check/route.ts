import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyResponse } from "@/lib/rateLimit";
import { checkExperience } from "@/lib/agents/experience/check";

export const maxDuration = 30;

const CHECK_LIMIT = 40;
const CHECK_WINDOW_MS = 10 * 60 * 1000;

/**
 * 저장된 경험을 다시 읽어 칸이 제대로 들어갔는지 점검하고 gaps를 갱신한다.
 * 저장(PATCH)과 분리해 둔 이유: 저장은 기다림 없이 끝나야 하고,
 * 점검은 그 뒤에 따라붙어도 되기 때문이다.
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

    const rl = rateLimit(`exp-check:${user.id}`, CHECK_LIMIT, CHECK_WINDOW_MS);
    if (!rl.allowed) return tooManyResponse(rl.retryAfterSec);

    const { id } = await params;
    const exp = await prisma.experience.findUnique({ where: { id } });

    if (!exp) {
      return NextResponse.json({ error: "경험을 찾을 수 없습니다." }, { status: 404 });
    }
    if (exp.userId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { gaps } = await checkExperience({
      title: exp.title,
      period: exp.period,
      role: exp.role,
      situation: exp.situation,
      action: exp.action,
      impact: exp.impact,
      learning: exp.learning,
      message: exp.message,
      tags: exp.tags,
    });

    await prisma.experience.update({
      where: { id },
      data: {
        gaps: gaps.length > 0 ? (gaps as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        organizedAt: new Date(),
      },
    });

    return NextResponse.json({ gaps }, { status: 200 });
  } catch (error) {
    console.error("경험 점검 에러:", error);
    return NextResponse.json({ error: "점검에 실패했습니다." }, { status: 500 });
  }
}
