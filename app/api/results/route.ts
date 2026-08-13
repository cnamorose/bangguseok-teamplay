import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 공부방 책장이므로 이 방에서 만든 것만.
    // (취업방 실행 기록도 같은 Result 표에 쌓이는데, 그쪽은 팀 조립이 없어 assembly가 없다)
    const where = { userId: user.id, mode: "study" };
    const orderBy = { createdAt: "desc" as const };
    // 목록에 필요한 것만 select (무거운 resultData 등은 제외 — 결과물이 많아져도 가볍게)
    const select = {
      id: true,
      topic: true,
      createdAt: true,
      assembly: { select: { name: true } },
    };

    // page 파라미터가 있으면 페이지네이션 모드 (한 번에 다 안 불러오고 페이지 단위로)
    const pageParam = req.nextUrl.searchParams.get("page");
    if (pageParam !== null) {
      const page = Math.max(1, Number(pageParam) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 5));

      const [results, total] = await Promise.all([
        prisma.result.findMany({
          where,
          orderBy,
          select,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.result.count({ where }),
      ]);

      return NextResponse.json(
        { results, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
        { status: 200 }
      );
    }

    // 파라미터 없으면 기존처럼 전부 반환 (책장 페이지 호환)
    const results = await prisma.result.findMany({ where, orderBy, select });
    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("결과 목록 조회 에러:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}