import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const results = await prisma.result.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        assembly: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("결과 목록 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}