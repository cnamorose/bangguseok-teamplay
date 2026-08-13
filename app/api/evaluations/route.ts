import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 평가단자료(클립보드) 목록
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const evaluations = await prisma.evaluation.findMany({
      // 공부방 클립보드 — 취업방에서 받은 평가(자소서 컨설팅 등)는 여기 섞이지 않게
      where: { userId: user.id, mode: "study" },
      orderBy: { createdAt: "desc" },
      // 목록엔 무거운 text/revised는 빼고, 점수 요약용 results만
      select: { id: true, topic: true, createdAt: true, results: true },
    });

    return NextResponse.json({ evaluations }, { status: 200 });
  } catch (error) {
    console.error("평가단자료 목록 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}
