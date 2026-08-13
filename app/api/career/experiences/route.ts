import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SELECT = {
  id: true,
  title: true,
  period: true,
  role: true,
  situation: true,
  action: true,
  impact: true,
  learning: true,
  message: true,
  tags: true,
  gaps: true,
  starred: true,
  organizedAt: true,
  updatedAt: true,
} as const;

/** 경험 목록 — 핵심으로 표시한 것이 위로 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const experiences = await prisma.experience.findMany({
      where: { userId: user.id },
      orderBy: [{ starred: "desc" }, { updatedAt: "desc" }],
      select: SELECT,
    });

    return NextResponse.json({ experiences }, { status: 200 });
  } catch (error) {
    console.error("경험 목록 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

/** 경험 추가. 제목만 있어도 저장된다 (일단 적어두는 단계를 막지 않으려고) */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await req.json();
    const title = String(body.title ?? "").trim().slice(0, 100);

    if (!title) {
      return NextResponse.json({ error: "경험 이름을 입력해주세요." }, { status: 400 });
    }

    const experience = await prisma.experience.create({
      data: {
        userId: user.id,
        title,
        raw: typeof body.raw === "string" ? body.raw.slice(0, 5000) : null,
        period: body.period || null,
        role: body.role || null,
        situation: body.situation || null,
        action: body.action || null,
        impact: body.impact || null,
        learning: body.learning || null,
        message: body.message || null,
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 6).map(String) : [],
        gaps: body.gaps ?? undefined,
        organizedAt: body.gaps ? new Date() : null,
      },
      select: SELECT,
    });

    return NextResponse.json({ experience }, { status: 200 });
  } catch (error) {
    console.error("경험 저장 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
