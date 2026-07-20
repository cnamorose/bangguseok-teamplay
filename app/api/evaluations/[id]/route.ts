import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 평가단자료(클립보드) 상세
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
    const evaluation = await prisma.evaluation.findUnique({ where: { id } });

    if (!evaluation) {
      return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
    }
    if (evaluation.userId !== user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    return NextResponse.json({ evaluation }, { status: 200 });
  } catch (error) {
    console.error("평가단자료 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}
