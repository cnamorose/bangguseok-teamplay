import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_NOTES_LEN = 5000;

/** 회사 분석 상세 (직무별 분석까지 함께) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: { applications: { orderBy: { updatedAt: "desc" } } },
    });

    if (!company) {
      return NextResponse.json({ error: "회사를 찾을 수 없습니다." }, { status: 404 });
    }
    if (company.userId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    return NextResponse.json({ company }, { status: 200 });
  } catch (error) {
    console.error("회사 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

/** 내 메모 저장 — 재분석해도 지워지지 않는 유일한 칸이다 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.company.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "회사를 찾을 수 없습니다." }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { notes } = await req.json();
    await prisma.company.update({
      where: { id },
      data: { notes: typeof notes === "string" ? notes.slice(0, MAX_NOTES_LEN) : null },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("메모 저장 에러:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
