import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isShelfColor } from "@/lib/shelf-color";

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

    const result = await prisma.result.findUnique({
      where: { id },
      include: {
        assembly: true,
        agentLogs: {
          orderBy: { startedAt: "asc" },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ error: "결과를 찾을 수 없습니다." }, { status: 404 });
    }

    // 본인 결과만 볼 수 있게
    if (result.userId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    console.error("결과 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

/** 책장에서 인덱스 탭 색 바꾸기 */
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
    const body = await req.json();

    // null이면 "자동으로 되돌리기"
    const color = body.color === null ? null : isShelfColor(body.color) ? body.color : undefined;
    if (color === undefined) {
      return NextResponse.json({ error: "쓸 수 없는 색이에요." }, { status: 400 });
    }

    const result = await prisma.result.findUnique({ where: { id }, select: { userId: true } });
    if (!result) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    if (result.userId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    await prisma.result.update({ where: { id }, data: { color } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("색 변경 에러:", error);
    return NextResponse.json({ error: "바꾸지 못했습니다." }, { status: 500 });
  }
}