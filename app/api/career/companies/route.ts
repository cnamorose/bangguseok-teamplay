import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 회사 목록. 카드에 필요한 것만 뽑고 무거운 analysis는 뺀다.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const rows = await prisma.company.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        analyzedAt: true,
        applications: {
          select: { id: true, role: true, analyzedAt: true },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    return NextResponse.json({ companies: rows }, { status: 200 });
  } catch (error) {
    console.error("회사 목록 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}
